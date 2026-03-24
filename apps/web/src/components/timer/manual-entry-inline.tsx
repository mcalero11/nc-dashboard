'use client';

import { useState, useMemo, type RefObject } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { TaskInput } from '@/components/task-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ProjectSelect } from '@/components/projects/project-select';
import { useCreateEntry } from '@/hooks/use-create-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { formatDate, getWeekDays } from '@/lib/date-utils';
import { MessageSquarePlus, Save } from 'lucide-react';

function validate(fields: {
  date: string;
  project: string;
  hours: number;
}): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!fields.date) errors.date = 'Date is required';
  if (!fields.project.trim()) errors.project = 'Project is required';
  if (fields.hours < 0.25 || fields.hours > 24) {
    errors.hours = 'Hours must be between 0.25 and 24.00';
  } else if (!Number.isInteger(fields.hours * 4)) {
    errors.hours = 'Hours must be in 0.25 increments';
  }
  return errors;
}

interface ManualEntryInlineProps {
  autoFocusRef?: RefObject<HTMLButtonElement | null>;
}

export function ManualEntryInline({ autoFocusRef }: ManualEntryInlineProps) {
  const [date, setDate] = useState(formatDate(new Date()));
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [hours, setHours] = useState(1);
  const [comments, setComments] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const createEntry = useCreateEntry();
  const { addJob } = usePendingSync();

  const weekDays = useMemo(() => getWeekDays(), []);

  function clearError(field: string) {
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function resetForm() {
    setDate(formatDate(new Date()));
    setProject('');
    setTask('');
    setHours(1);
    setComments('');
    setShowComments(false);
    setErrors({});
  }

  async function handleSubmit() {
    const validationErrors = validate({ date, project, hours });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await createEntry.mutateAsync({
        date,
        project,
        task: task.trim() || undefined,
        hours,
        comments: comments.trim() || undefined,
      });
      addJob({
        jobId: result.jobId,
        rowIndex: null,
        operation: 'create',
        label: 'Entry created',
      });
      resetForm();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create entry',
      );
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]">
        <div>
          <Label className="text-xs">Date</Label>
          <Select
            value={date}
            onValueChange={(v) => {
              setDate(v ?? '');
              clearError('date');
            }}
          >
            <SelectTrigger ref={autoFocusRef} className="w-full">
              <SelectValue placeholder="Select date" />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {d.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.date && (
            <p className="text-sm text-destructive mt-1">{errors.date}</p>
          )}
        </div>

        <div>
          <Label className="text-xs">Project</Label>
          <ProjectSelect
            value={project}
            onChange={(v) => {
              setProject(v);
              clearError('project');
            }}
          />
          {errors.project && (
            <p className="text-sm text-destructive mt-1">{errors.project}</p>
          )}
        </div>

        <div>
          <Label className="text-xs">Task (optional)</Label>
          <TaskInput
            value={task}
            onChange={setTask}
            placeholder="What did you work on?"
          />
        </div>

        <div>
          <Label className="text-xs">Hours</Label>
          <Input
            type="number"
            step="0.25"
            min="0.25"
            max="24"
            value={hours}
            onChange={(e) => {
              setHours(Number(e.target.value));
              clearError('hours');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            className="w-20"
          />
          {errors.hours && (
            <p className="text-sm text-destructive mt-1">{errors.hours}</p>
          )}
        </div>

        <div className="flex items-end">
          <Button
            onClick={handleSubmit}
            disabled={createEntry.isPending}
            className="gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {createEntry.isPending ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {showComments ? (
        <div>
          <Label className="text-xs">Comments</Label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Optional comments..."
            rows={2}
          />
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowComments(true)}
        >
          <MessageSquarePlus className="h-3 w-3" />
          Add comment
        </button>
      )}
    </div>
  );
}
