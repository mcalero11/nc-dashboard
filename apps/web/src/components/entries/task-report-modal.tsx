'use client';

import type { TaskSummaryResponse } from '@nc-dashboard/shared';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useTaskSummary } from '@/hooks/use-task-summary';
import { formatHours } from '@/lib/format-utils';

interface TaskReportModalProps {
  task: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function SummarySkeleton() {
  return (
    <div className="space-y-3">
      <div className="rounded-xl border bg-muted/30 p-4">
        <Skeleton className="mb-2 h-3 w-20" />
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="rounded-lg border p-3">
        <Skeleton className="mb-2 h-3 w-16" />
        <Skeleton className="h-5 w-48" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-12 flex-1 rounded-lg" />
        <Skeleton className="h-12 flex-1 rounded-lg" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

function SummaryStats({ data }: { data: TaskSummaryResponse }) {
  const dateRange =
    data.earliestDate && data.latestDate
      ? data.earliestDate === data.latestDate
        ? data.earliestDate
        : `${data.earliestDate} — ${data.latestDate}`
      : '—';

  return (
    <div className="space-y-3">
      {/* Hero: Total Hours */}
      <div className="rounded-xl border bg-muted/30 p-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Total Hours
        </p>
        <p className="text-3xl font-bold tabular-nums">
          {formatHours(data.totalHours)}
        </p>
      </div>

      {/* Secondary: Date Range */}
      <div className="rounded-lg border bg-muted/20 p-3">
        <p className="text-xs text-muted-foreground">Date Range</p>
        <p className="text-sm font-medium tabular-nums">{dateRange}</p>
      </div>

      {/* Tertiary: Entries + Avg inline */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg border px-3 py-2">
          <p className="text-xs text-muted-foreground">Entries</p>
          <p className="text-sm tabular-nums">{data.entryCount}</p>
        </div>
        <div className="flex-1 rounded-lg border px-3 py-2">
          <p className="text-xs text-muted-foreground">Avg Hours/Entry</p>
          <p className="text-sm tabular-nums">
            {formatHours(data.averageHoursPerEntry)}
          </p>
        </div>
      </div>
    </div>
  );
}

function EntriesTable({ data }: { data: TaskSummaryResponse }) {
  if (data.entries.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No entries found for this task.
      </p>
    );
  }

  return (
    <div className="max-h-72 overflow-y-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Project</TableHead>
            <TableHead className="text-right">Hours</TableHead>
            <TableHead>Comments</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.entries.map((entry, i) => (
            <TableRow key={`${entry.date}-${entry.project}-${i}`}>
              <TableCell className="whitespace-nowrap">{entry.date}</TableCell>
              <TableCell>{entry.project}</TableCell>
              <TableCell className="text-right tabular-nums">
                {formatHours(entry.hours)}
              </TableCell>
              <TableCell
                className="max-w-[160px] truncate text-muted-foreground"
                title={entry.comments}
              >
                {entry.comments}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function TaskReportModal({
  task,
  open,
  onOpenChange,
}: TaskReportModalProps) {
  const { data, isLoading } = useTaskSummary(open ? task : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{task}</DialogTitle>
          <DialogDescription>Task summary report</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <SummarySkeleton />
        ) : data ? (
          <div className="space-y-4">
            <SummaryStats data={data} />
            <EntriesTable data={data} />
          </div>
        ) : (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No entries found for this task.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
