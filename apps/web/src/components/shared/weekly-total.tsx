interface WeeklyTotalProps {
  totalHours: number;
}

function formatHours(h: number): string {
  return Number.isInteger(h) ? String(h) : parseFloat(h.toFixed(2)).toString();
}

export function WeeklyTotal({ totalHours }: WeeklyTotalProps) {
  return (
    <div className="text-sm text-muted-foreground">
      Weekly total:{' '}
      <span className="font-semibold text-foreground">
        {formatHours(totalHours)}h
      </span>
    </div>
  );
}
