'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus } from 'lucide-react';

function validate(fields: {
  date: string;
  project: string;
  task: string;
  hours: number;
}): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!fields.date) {
    errors.date = 'Date is required';
  }
  if (!fields.project.trim()) {
    errors.project = 'Project is required';
  }
  if (fields.hours < 0.25 || fields.hours > 24) {
    errors.hours = 'Hours must be between 0.25 and 24.00';
  } else if (!Number.isInteger(fields.hours * 4)) {
    errors.hours = 'Hours must be in 0.25 increments';
  }

  return errors;
}

export function ManualEntryForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [date, setDate] = useState(formatDate(new Date()));
  const [project, setProject] = useState('');
  const [task, setTask] = useState('');
  const [hours, setHours] = useState(1);
  const [comments, setComments] = useState('');
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

  async function handleSubmit() {
    const validationErrors = validate({ date, project, task, hours });
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      const result = await createEntry.mutateAsync({
        date,
        project: project.trim(),
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
      setDate(formatDate(new Date()));
      setProject('');
      setTask('');
      setHours(1);
      setComments('');
      setErrors({});
      setIsOpen(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to create entry',
      );
    }
  }

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="gap-2"
      >
        <Plus className="h-4 w-4" />
        Manual Entry
      </Button>
    );
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label>Date</Label>
          <Select
            value={date}
            onValueChange={(v) => {
              setDate(v ?? '');
              clearError('date');
            }}
          >
            <SelectTrigger className="w-full">
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
          <Label>Project</Label>
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
          <Label>Task (optional)</Label>
          <Input
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="What did you work on?"
          />
        </div>
        <div>
          <Label>Hours</Label>
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
          />
          {errors.hours && (
            <p className="text-sm text-destructive mt-1">{errors.hours}</p>
          )}
        </div>
        <div className="sm:col-span-2">
          <Label>Comments</Label>
          <Textarea
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Optional comments..."
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button
          onClick={handleSubmit}
          disabled={createEntry.isPending}
          size="sm"
        >
          {createEntry.isPending ? 'Saving...' : 'Save'}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setIsOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
