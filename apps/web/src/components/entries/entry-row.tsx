'use client';

import { useState, useMemo } from 'react';
import type { TimeEntry } from '@nc-dashboard/shared';
import { TableCell, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TaskInput } from '@/components/task-input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectSelect } from '@/components/projects/project-select';
import {
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  Copy,
  BarChart3,
  Play,
} from 'lucide-react';
import { DeleteEntryDialog } from './delete-entry-dialog';
import { TaskReportModal } from './task-report-modal';
import { useUpdateEntry } from '@/hooks/use-update-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { getWeekDays, formatDate } from '@/lib/date-utils';
import { toast } from 'sonner';
import { formatHours } from '@/lib/format-utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface EntryRowProps {
  entry: TimeEntry;
  editable?: boolean;
  taskTotals?: Map<string, number>;
  onResume?: (entry: TimeEntry) => void;
}

export function EntryRow({
  entry,
  editable = true,
  taskTotals,
  onResume,
}: EntryRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [editValues, setEditValues] = useState({
    date: entry.date,
    project: entry.project,
    task: entry.task,
    hours: entry.hours,
    comments: entry.comments,
  });
  const updateEntry = useUpdateEntry();
  const { addJob, isRowPending } = usePendingSync();
  const pending = isRowPending(entry.rowIndex);

  const weekDays = useMemo(() => getWeekDays(), []);
  const isToday = entry.date === formatDate(new Date());

  function handleStartEdit() {
    setEditValues({
      date: entry.date,
      project: entry.project,
      task: entry.task,
      hours: Math.round(entry.hours * 4) / 4 || 0.25,
      comments: entry.comments,
    });
    setIsEditing(true);
  }

  async function handleSave() {
    if (
      editValues.hours < 0.25 ||
      editValues.hours > 24 ||
      !Number.isInteger(editValues.hours * 4)
    ) {
      toast.error('Hours must be between 0.25 and 24 in 0.25 increments');
      return;
    }
    try {
      const result = await updateEntry.mutateAsync({
        rowIndex: entry.rowIndex,
        data: {
          date: editValues.date,
          project: editValues.project,
          task: editValues.task,
          hours: editValues.hours,
          comments: editValues.comments || undefined,
        },
      });
      addJob({
        jobId: result.jobId,
        rowIndex: entry.rowIndex,
        operation: 'update',
        label: 'Entry updated',
      });
      setIsEditing(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update entry',
      );
    }
  }

  function handleEditKeyDown(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key === 'Escape') {
      setIsEditing(false);
    } else if (e.key === 'Enter') {
      handleSave();
    }
  }

  if (isEditing) {
    return (
      <TableRow
        className={
          pending
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : isToday
              ? 'bg-blue-50 dark:bg-blue-950/20'
              : undefined
        }
        onKeyDown={handleEditKeyDown}
      >
        {onResume && <TableCell />}
        <TableCell>
          <Select
            value={editValues.date}
            onValueChange={(v) =>
              setEditValues((prev) => ({ ...prev, date: v ?? prev.date }))
            }
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TableCell>
        <TableCell>
          <ProjectSelect
            value={editValues.project}
            onChange={(v) =>
              setEditValues((prev) => ({ ...prev, project: v, task: '' }))
            }
          />
        </TableCell>
        <TableCell>
          <TaskInput
            value={editValues.task}
            onChange={(v) => setEditValues((prev) => ({ ...prev, task: v }))}
            project={editValues.project}
          />
        </TableCell>
        <TableCell className="text-right">
          <Input
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={editValues.hours}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, hours: Number(e.target.value) }))
            }
            className="w-20 ml-auto"
          />
        </TableCell>
        <TableCell>
          <Input
            value={editValues.comments}
            onChange={(e) =>
              setEditValues((v) => ({ ...v, comments: e.target.value }))
            }
          />
        </TableCell>
        <TableCell>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSave}
              disabled={updateEntry.isPending}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      <TableRow
        className={
          pending
            ? 'bg-amber-50 dark:bg-amber-950/30'
            : isToday
              ? 'bg-blue-50 dark:bg-blue-950/20'
              : undefined
        }
      >
        {onResume && (
          <TableCell className="w-[40px] px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onResume(entry)}
              aria-label="Resume timer"
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          </TableCell>
        )}
        <TableCell>{entry.date}</TableCell>
        <TableCell>{entry.project}</TableCell>
        <TableCell>
          {entry.task ? (
            <span className="group/task inline-flex items-center gap-1">
              {entry.task}
              <button
                type="button"
                aria-label="Copy task name"
                className="invisible group-hover/task:visible text-muted-foreground hover:text-foreground transition-colors"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(entry.task);
                    toast.success('Copied!');
                  } catch {
                    toast.error('Failed to copy to clipboard');
                  }
                }}
              >
                <Copy className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Task report"
                className="invisible group-hover/task:visible text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowReport(true)}
              >
                <BarChart3 className="h-3 w-3" />
              </button>
              {taskTotals?.has(entry.task) && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="invisible group-hover/task:visible text-xs text-muted-foreground tabular-nums cursor-default" />
                      }
                    >
                      {formatHours(taskTotals.get(entry.task)!)}h
                    </TooltipTrigger>
                    <TooltipContent>Total this week</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          ) : null}
        </TableCell>
        <TableCell className="text-right">{formatHours(entry.hours)}</TableCell>
        <TableCell className="text-muted-foreground">
          {entry.comments}
        </TableCell>
        <TableCell>
          {pending ? (
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="text-xs font-medium">Syncing...</span>
            </div>
          ) : editable ? (
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={handleStartEdit}>
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ) : null}
        </TableCell>
      </TableRow>
      <DeleteEntryDialog
        open={showDelete}
        onOpenChange={setShowDelete}
        rowIndex={entry.rowIndex}
      />
      <TaskReportModal
        task={entry.task}
        open={showReport}
        onOpenChange={setShowReport}
      />
    </>
  );
}
