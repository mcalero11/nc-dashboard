'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ProjectSelect } from '@/components/projects/project-select';
import { TaskInput } from '@/components/task-input';
import { Play, Square } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  currentProject: string;
  currentTask: string;
  onStart: (project: string, task: string) => void;
  onStop: () => void;
}

export function TimerControls({
  isRunning,
  currentProject,
  currentTask,
  onStart,
  onStop,
}: TimerControlsProps) {
  const [project, setProject] = useState(currentProject);
  const [task, setTask] = useState(currentTask);

  function handleStart() {
    if (!project.trim()) return;
    onStart(project, task.trim());
  }

  if (isRunning) {
    return (
      <div className="flex items-center gap-3">
        <span className="text-sm text-muted-foreground">
          {currentProject} &mdash; {currentTask}
        </span>
        <Button
          variant="destructive"
          size="sm"
          onClick={onStop}
          className="gap-2"
        >
          <Square className="h-3 w-3" />
          Stop
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <ProjectSelect value={project} onChange={setProject} />
      <TaskInput
        placeholder="Task"
        value={task}
        onChange={setTask}
        onKeyDown={(e) => e.key === 'Enter' && handleStart()}
        className="sm:flex-1"
      />
      <Button
        onClick={handleStart}
        disabled={!project.trim()}
        className="gap-2"
      >
        <Play className="h-3 w-3" />
        Start
      </Button>
    </div>
  );
}
