'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Clock, PenLine } from 'lucide-react';
import type { TimeEntry } from '@nc-dashboard/shared';
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { TimerDisplay } from './timer-display';
import { TimerControls } from './timer-controls';
import { ManualEntryInline } from './manual-entry-inline';
import { useTimer } from '@/hooks/use-timer';
import { useCreateEntry } from '@/hooks/use-create-entry';
import { useUpdateEntry } from '@/hooks/use-update-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { secondsToDecimalHours } from '@/lib/timer-utils';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

function computeNewElapsed(
  elapsed: number,
  resumeOriginalHours: number | null,
): number {
  return resumeOriginalHours != null
    ? elapsed - resumeOriginalHours * 3600
    : elapsed;
}

type TabValue = 'timer' | 'manual';

interface TimeEntryCardProps {
  resumeEntry?: TimeEntry | null;
  onResumeHandled?: () => void;
}

export function TimeEntryCard({
  resumeEntry,
  onResumeHandled,
}: TimeEntryCardProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('timer');
  const [pendingProject, setPendingProject] = useState('');
  const [pendingTask, setPendingTask] = useState('');
  const [showResumeConfirm, setShowResumeConfirm] = useState(false);
  const [pendingResume, setPendingResume] = useState<TimeEntry | null>(null);
  const timer = useTimer();
  const createEntry = useCreateEntry();
  const updateEntry = useUpdateEntry();
  const { addJob } = usePendingSync();
  const manualFocusRef = useRef<HTMLButtonElement | null>(null);

  function doStartResume(entry: TimeEntry) {
    const isToday = entry.date === formatDate(new Date());
    if (isToday) {
      timer.startResume(
        entry.project,
        entry.task,
        entry.comments,
        entry.rowIndex,
        entry.hours,
        entry.date,
      );
    } else {
      timer.setComment(entry.comments);
      timer.start(entry.project, entry.task);
    }
    setActiveTab('timer');
  }

  const [prevResumeEntry, setPrevResumeEntry] = useState(resumeEntry);
  if (resumeEntry && resumeEntry !== prevResumeEntry) {
    setPrevResumeEntry(resumeEntry);
    setPendingResume(resumeEntry);
    if (timer.isRunning) {
      setShowResumeConfirm(true);
    }
  } else if (resumeEntry !== prevResumeEntry) {
    setPrevResumeEntry(resumeEntry);
  }

  // Process pending resume after render when timer is idle.
  // This effect intentionally calls doStartResume (which sets timer state)
  // and clears the pending entry — a valid "sync with external system" pattern.
  useEffect(() => {
    if (pendingResume && !timer.isRunning && !showResumeConfirm) {
      doStartResume(pendingResume); // eslint-disable-line react-hooks/set-state-in-effect
      setPendingResume(null);
      onResumeHandled?.();
    }
  }, [pendingResume, timer.isRunning, showResumeConfirm]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleResumeConfirm() {
    if (!pendingResume) return;
    if (updateEntry.isPending || createEntry.isPending) return;

    // Save the currently running timer before starting the resumed one
    const data = timer.capture();
    const newElapsed = computeNewElapsed(
      data.elapsed,
      data.resumeOriginalHours,
    );
    if (newElapsed >= 60) {
      const totalHours = secondsToDecimalHours(data.elapsed);
      try {
        if (data.resumeRowIndex != null && data.resumeOriginalHours != null) {
          // Running timer was itself a resume — update the original entry
          const addedHours =
            Math.round((totalHours - data.resumeOriginalHours) * 100) / 100;
          const result = await updateEntry.mutateAsync({
            rowIndex: data.resumeRowIndex,
            data: {
              date: data.resumeDate!,
              project: data.project,
              task: data.task,
              hours: totalHours,
              comments: data.comment || undefined,
            },
          });
          addJob({
            jobId: result.jobId,
            rowIndex: data.resumeRowIndex,
            operation: 'update',
            label: `Added ${addedHours}h to entry (total: ${totalHours}h)`,
          });
        } else {
          // Normal timer — create a new entry
          const result = await createEntry.mutateAsync({
            date: formatDate(new Date()),
            project: data.project,
            task: data.task,
            hours: totalHours,
            comments: data.comment || undefined,
          });
          addJob({
            jobId: result.jobId,
            rowIndex: null,
            operation: 'create',
            label: 'Time entry saved!',
          });
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to save entry',
        );
        setPendingResume(null);
        setShowResumeConfirm(false);
        onResumeHandled?.();
        return;
      }
    }

    timer.reset();
    doStartResume(pendingResume);
    setPendingResume(null);
    setShowResumeConfirm(false);
    onResumeHandled?.();
  }

  function handleResumeCancel() {
    setPendingResume(null);
    setShowResumeConfirm(false);
    onResumeHandled?.();
  }

  async function handleStop() {
    if (updateEntry.isPending || createEntry.isPending) return;
    const data = timer.capture();
    const newElapsed = computeNewElapsed(
      data.elapsed,
      data.resumeOriginalHours,
    );
    if (newElapsed < 60) {
      toast.warning('Entry too short. Minimum is 1 minute.');
      timer.reset();
      return;
    }

    const totalHours = secondsToDecimalHours(data.elapsed);

    // Resume mode: update existing entry with total elapsed (includes original hours)
    if (data.resumeRowIndex != null && data.resumeOriginalHours != null) {
      if (totalHours > 24) {
        toast.error(
          `Total hours (${totalHours}) would exceed 24. Entry not updated.`,
        );
        return;
      }
      const addedHours =
        Math.round((totalHours - data.resumeOriginalHours) * 100) / 100;
      try {
        const result = await updateEntry.mutateAsync({
          rowIndex: data.resumeRowIndex,
          data: {
            date: data.resumeDate!,
            project: data.project,
            task: data.task,
            hours: totalHours,
            comments: data.comment || undefined,
          },
        });
        addJob({
          jobId: result.jobId,
          rowIndex: data.resumeRowIndex,
          operation: 'update',
          label: `Added ${addedHours}h to entry (total: ${totalHours}h)`,
        });
        timer.reset();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update entry',
        );
      }
      return;
    }

    // Normal mode: create new entry
    try {
      const result = await createEntry.mutateAsync({
        date: formatDate(new Date()),
        project: data.project,
        task: data.task,
        hours: totalHours,
        comments: data.comment || undefined,
      });
      addJob({
        jobId: result.jobId,
        rowIndex: null,
        operation: 'create',
        label: 'Time entry saved!',
      });
      timer.reset();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create entry',
      );
    }
  }

  const shortcuts = useMemo(
    () => [
      {
        key: 'i',
        ignoreWhenInputFocused: true,
        handler: () => {
          setActiveTab('manual');
          // Focus the first field after React renders the tab
          requestAnimationFrame(() => {
            manualFocusRef.current?.focus();
          });
        },
      },
      {
        key: 'Escape',
        ignoreWhenInputFocused: false,
        handler: () => {
          setActiveTab('timer');
          if (document.activeElement instanceof HTMLElement) {
            document.activeElement.blur();
          }
        },
      },
    ],
    [],
  );

  useKeyboardShortcuts(shortcuts);

  const isManual = activeTab === 'manual';

  return (
    <Card
      className={cn('transition-shadow', isManual && 'ring-2 ring-primary/20')}
    >
      <Tabs
        value={activeTab}
        onValueChange={useCallback(
          (v: unknown) => setActiveTab(v as TabValue),
          [],
        )}
      >
        <CardHeader>
          <TabsList>
            <TabsTrigger value="timer" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Timer
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-1.5">
              <PenLine className="h-3.5 w-3.5" />
              Manual Entry
            </TabsTrigger>
          </TabsList>
          <CardAction>
            <div className="flex items-center gap-3">
              {timer.isRunning && isManual && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                  </span>
                  <span className="font-mono tabular-nums">
                    {timer.display}
                  </span>
                </div>
              )}
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Press{' '}
                <kbd className="rounded border px-1 py-0.5 text-[10px] font-mono">
                  i
                </kbd>{' '}
                for manual
              </span>
            </div>
          </CardAction>
        </CardHeader>

        <CardContent>
          <TabsContent value="timer">
            <div className="flex flex-col gap-4">
              <TimerDisplay
                display={timer.display}
                isRunning={timer.isRunning}
              />
              <TimerControls
                isRunning={timer.isRunning}
                currentProject={timer.project}
                currentTask={timer.task}
                currentComment={timer.comment}
                onStart={timer.start}
                onStop={handleStop}
                onCommentChange={timer.setComment}
                onProjectChange={(p) => {
                  setPendingProject(p);
                  setPendingTask('');
                }}
                onTaskChange={setPendingTask}
              />
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <ManualEntryInline
              autoFocusRef={manualFocusRef}
              initialProject={timer.isRunning ? timer.project : pendingProject}
              initialTask={timer.isRunning ? timer.task : pendingTask}
            />
          </TabsContent>
        </CardContent>
      </Tabs>

      <Dialog
        open={showResumeConfirm}
        onOpenChange={(open) => {
          if (!open) handleResumeCancel();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Timer already running</DialogTitle>
            <DialogDescription>
              A timer is already running. Stop it and start a new one?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={handleResumeCancel}>
              Cancel
            </Button>
            <Button onClick={handleResumeConfirm}>Stop &amp; Resume</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
