'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface WeekSelectorProps {
  weekOffset: number;
  weekStart?: string;
  weekEnd?: string;
  onOffsetChange: (offset: number) => void;
}

export function WeekSelector({
  weekOffset,
  weekStart,
  weekEnd,
  onOffsetChange,
}: WeekSelectorProps) {
  const isCurrentWeek = weekOffset === 0;
  const label = isCurrentWeek
    ? 'This Week'
    : weekOffset === -1
      ? 'Last Week'
      : `${weekStart} – ${weekEnd}`;

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onOffsetChange(weekOffset - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-lg font-semibold min-w-[100px] text-center">
        {label}
      </span>
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onOffsetChange(weekOffset + 1)}
        disabled={isCurrentWeek}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
