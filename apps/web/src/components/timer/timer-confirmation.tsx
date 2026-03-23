'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { secondsToDecimalHours } from '@/lib/timer-utils';
import { formatDate } from '@/lib/date-utils';

interface TimerConfirmationProps {
  project: string;
  task: string;
  elapsed: number;
  onConfirm: (data: {
    project: string;
    task: string;
    hours: number;
    comments: string;
  }) => void;
  onCancel: () => void;
  isPending: boolean;
  /** Render without Card wrapper (for embedding inside another Card) */
  inline?: boolean;
}

export function TimerConfirmation({
  project,
  task,
  elapsed,
  onConfirm,
  onCancel,
  isPending,
  inline,
}: TimerConfirmationProps) {
  const [editTask, setEditTask] = useState(task);
  const [hours, setHours] = useState(secondsToDecimalHours(elapsed));
  const [comments, setComments] = useState('');

  const fields = (
    <div className="space-y-3">
      <div>
        <Label className="text-xs text-muted-foreground">Date</Label>
        <p className="text-sm font-medium">{formatDate(new Date())}</p>
      </div>
      <div>
        <Label className="text-xs text-muted-foreground">Project</Label>
        <p className="text-sm font-medium">{project}</p>
      </div>
      <div>
        <Label htmlFor="task">Task (optional)</Label>
        <Input
          id="task"
          value={editTask}
          onChange={(e) => setEditTask(e.target.value)}
          placeholder="What did you work on?"
        />
      </div>
      <div>
        <Label htmlFor="hours">Hours</Label>
        <Input
          id="hours"
          type="number"
          step="0.25"
          min="0.25"
          max="24"
          value={hours}
          onChange={(e) => setHours(Number(e.target.value))}
        />
      </div>
      <div>
        <Label htmlFor="comments">Comments (optional)</Label>
        <Input
          id="comments"
          value={comments}
          onChange={(e) => setComments(e.target.value)}
        />
      </div>
    </div>
  );

  const actions = (
    <div className="flex gap-2">
      <Button variant="outline" onClick={onCancel} disabled={isPending}>
        Discard
      </Button>
      <Button
        onClick={() =>
          onConfirm({ project, task: editTask, hours, comments })
        }
        disabled={isPending || hours < 0.25 || !Number.isInteger(hours * 4)}
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          'Save Entry'
        )}
      </Button>
    </div>
  );

  if (inline) {
    return (
      <div className="space-y-3">
        <h3 className="text-base font-medium">Save Time Entry</h3>
        {fields}
        {actions}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Save Time Entry</CardTitle>
      </CardHeader>
      <CardContent>{fields}</CardContent>
      <CardFooter className="gap-2">{actions}</CardFooter>
    </Card>
  );
}
