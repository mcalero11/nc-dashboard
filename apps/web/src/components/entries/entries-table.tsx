'use client';

import type { TimeEntry } from '@nc-dashboard/shared';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EntryRow } from './entry-row';
import { EmptyState } from '@/components/shared/empty-state';

interface EntriesTableProps {
  entries: TimeEntry[];
  filterProject?: string;
  editable?: boolean;
}

function parseDate(dd_mm_yyyy: string): number {
  const [d, m, y] = dd_mm_yyyy.split('/');
  return new Date(+y, +m - 1, +d).getTime();
}

export function EntriesTable({
  entries,
  filterProject,
  editable = true,
}: EntriesTableProps) {
  const filtered = (
    filterProject
      ? entries.filter((e) => e.project === filterProject)
      : [...entries]
  ).sort((a, b) => {
    const diff = parseDate(b.date) - parseDate(a.date);
    return diff !== 0 ? diff : b.rowIndex - a.rowIndex;
  });

  if (filtered.length === 0) {
    return (
      <EmptyState
        title="No entries yet"
        description="Start the timer or add a manual entry to get started."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Project</TableHead>
          <TableHead>Task</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead>Comments</TableHead>
          <TableHead className="w-[80px]" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((entry) => (
          <EntryRow key={entry.rowIndex} entry={entry} editable={editable} />
        ))}
      </TableBody>
    </Table>
  );
}
