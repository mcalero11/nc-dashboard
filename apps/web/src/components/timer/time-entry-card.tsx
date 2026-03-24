'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import { Clock, PenLine } from 'lucide-react';
import {
  Card,
  CardHeader,
  CardAction,
  CardContent,
} from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TimerDisplay } from './timer-display';
import { TimerControls } from './timer-controls';
import { ManualEntryInline } from './manual-entry-inline';
import { useTimer } from '@/hooks/use-timer';
import { useCreateEntry } from '@/hooks/use-create-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { secondsToDecimalHours } from '@/lib/timer-utils';
import { formatDate } from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type TabValue = 'timer' | 'manual';

export function TimeEntryCard() {
  const [activeTab, setActiveTab] = useState<TabValue>('timer');
  const timer = useTimer();
  const createEntry = useCreateEntry();
  const { addJob } = usePendingSync();
  const manualFocusRef = useRef<HTMLButtonElement | null>(null);

  async function handleStop() {
    const data = timer.stop();
    if (data.elapsed < 60) {
      toast.warning('Entry too short. Minimum is 1 minute.');
      return;
    }
    try {
      const result = await createEntry.mutateAsync({
        date: formatDate(new Date()),
        project: data.project,
        task: data.task,
        hours: secondsToDecimalHours(data.elapsed),
      });
      addJob({
        jobId: result.jobId,
        rowIndex: null,
        operation: 'create',
        label: 'Time entry saved!',
      });
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
                onStart={timer.start}
                onStop={handleStop}
              />
            </div>
          </TabsContent>

          <TabsContent value="manual">
            <ManualEntryInline autoFocusRef={manualFocusRef} />
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}
