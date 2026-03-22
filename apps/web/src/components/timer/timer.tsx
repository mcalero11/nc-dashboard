'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { TimerDisplay } from './timer-display';
import { TimerControls } from './timer-controls';
import { TimerConfirmation } from './timer-confirmation';
import { useTimer } from '@/hooks/use-timer';
import { useCreateEntry } from '@/hooks/use-create-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { formatDate } from '@/lib/date-utils';

interface StoppedData {
  elapsed: number;
  project: string;
  task: string;
}

export function Timer() {
  const timer = useTimer();
  const createEntry = useCreateEntry();
  const { addJob } = usePendingSync();
  const [stoppedData, setStoppedData] = useState<StoppedData | null>(null);

  function handleStop() {
    const data = timer.stop();
    if (data.elapsed < 60) {
      toast.warning('Entry too short. Minimum is 1 minute.');
      return;
    }
    setStoppedData(data);
  }

  async function handleConfirm(data: {
    project: string;
    task: string;
    hours: number;
    comments: string;
  }) {
    try {
      const result = await createEntry.mutateAsync({
        date: formatDate(new Date()),
        project: data.project,
        task: data.task,
        hours: data.hours,
        comments: data.comments || undefined,
      });
      addJob({
        jobId: result.jobId,
        rowIndex: null,
        operation: 'create',
        label: 'Time entry saved!',
      });
      setStoppedData(null);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create entry',
      );
    }
  }

  function handleCancel() {
    setStoppedData(null);
  }

  if (stoppedData) {
    return (
      <TimerConfirmation
        project={stoppedData.project}
        task={stoppedData.task}
        elapsed={stoppedData.elapsed}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isPending={createEntry.isPending}
      />
    );
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        <TimerDisplay display={timer.display} isRunning={timer.isRunning} />
        <TimerControls
          isRunning={timer.isRunning}
          currentProject={timer.project}
          currentTask={timer.task}
          onStart={timer.start}
          onStop={handleStop}
        />
      </CardContent>
    </Card>
  );
}
