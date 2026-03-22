'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JobStatusResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, JOB_POLL_INTERVAL } from '@/lib/constants';

export function useJobStatus(jobId: string | null) {
  const queryClient = useQueryClient();

  return useQuery<JobStatusResponse>({
    queryKey: QUERY_KEYS.jobStatus(jobId!),
    queryFn: () => apiFetch<JobStatusResponse>(API_PATHS.JOB_STATUS(jobId!)),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'completed' || status === 'failed') {
        if (status === 'completed') {
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.weekEntries() });
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
        }
        return false;
      }
      return JOB_POLL_INTERVAL;
    },
  });
}
