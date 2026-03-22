'use client';

interface TimerDisplayProps {
  display: string;
  isRunning: boolean;
}

export function TimerDisplay({ display, isRunning }: TimerDisplayProps) {
  return (
    <div
      className={`font-mono text-4xl font-bold tabular-nums tracking-wider ${
        isRunning ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      {display}
    </div>
  );
}
