'use client';

import { createContext, useState, useCallback, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useJobStatus } from '@/hooks/use-job-status';
import { QUERY_KEYS } from '@/lib/constants';
import { toast } from 'sonner';

type SyncOperation = 'create' | 'update' | 'delete';

export interface PendingJob {
  jobId: string;
  rowIndex: number | null;
  operation: SyncOperation;
  label: string;
}

interface PendingSyncContextValue {
  addJob: (job: PendingJob) => void;
  isRowPending: (rowIndex: number) => boolean;
}

export const PendingSyncContext = createContext<PendingSyncContextValue | null>(
  null,
);

function JobPoller({
  job,
  onDone,
}: {
  job: PendingJob;
  onDone: (jobId: string) => void;
}) {
  const { data } = useJobStatus(job.jobId);
  const queryClient = useQueryClient();
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    const status = data?.status;
    if (status === 'completed') {
      firedRef.current = true;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.weekEntries() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
      toast.success(job.label);
      onDone(job.jobId);
    } else if (status === 'failed') {
      firedRef.current = true;
      toast.error(`Failed: ${job.label}`);
      onDone(job.jobId);
    }
  }, [data?.status, job.jobId, job.label, onDone, queryClient]);

  return null;
}

export function PendingSyncProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [jobs, setJobs] = useState<Map<string, PendingJob>>(new Map());

  const addJob = useCallback((job: PendingJob) => {
    setJobs((prev) => new Map(prev).set(job.jobId, job));
  }, []);

  const removeJob = useCallback((jobId: string) => {
    setJobs((prev) => {
      const next = new Map(prev);
      next.delete(jobId);
      return next;
    });
  }, []);

  const isRowPending = useCallback(
    (rowIndex: number) => {
      for (const job of jobs.values()) {
        if (job.rowIndex === rowIndex) return true;
      }
      return false;
    },
    [jobs],
  );

  return (
    <PendingSyncContext value={{ addJob, isRowPending }}>
      {Array.from(jobs.values()).map((job) => (
        <JobPoller key={job.jobId} job={job} onDone={removeJob} />
      ))}
      {children}
    </PendingSyncContext>
  );
}
