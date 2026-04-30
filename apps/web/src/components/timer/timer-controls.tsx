'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ProjectSelect } from '@/components/projects/project-select';
import { TaskInput } from '@/components/task-input';
import { Play, Square, MessageSquarePlus } from 'lucide-react';

interface TimerControlsProps {
  isRunning: boolean;
  currentProject: string;
  currentTask: string;
  currentComment: string;
  onStart: (project: string, task: string) => void;
  onStop: () => void;
  onCommentChange: (comment: string) => void;
  onProjectChange?: (project: string) => void;
  onTaskChange?: (task: string) => void;
}

export function TimerControls({
  isRunning,
  currentProject,
  currentTask,
  currentComment,
  onStart,
  onStop,
  onCommentChange,
  onProjectChange,
  onTaskChange,
}: TimerControlsProps) {
  const [project, setProject] = useState(currentProject);
  const [task, setTask] = useState(currentTask);
  const [showComment, setShowComment] = useState(!!currentComment);
  const [prevProps, setPrevProps] = useState({ currentProject, currentTask });

  if (
    !isRunning &&
    (currentProject !== prevProps.currentProject ||
      currentTask !== prevProps.currentTask)
  ) {
    setPrevProps({ currentProject, currentTask });
    setProject(currentProject);
    setTask(currentTask);
  } else if (
    currentProject !== prevProps.currentProject ||
    currentTask !== prevProps.currentTask
  ) {
    setPrevProps({ currentProject, currentTask });
  }

  function handleProjectChange(v: string) {
    const prev = project;
    setProject(v);
    if (prev.trim() !== '') {
      setTask('');
      onTaskChange?.('');
    }
    onProjectChange?.(v);
  }

  function handleStart() {
    if (!project.trim()) return;
    onStart(project, task.trim());
  }

  return (
    <div className="flex flex-col gap-3">
      {isRunning ? (
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
      ) : (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <ProjectSelect value={project} onChange={handleProjectChange} />
          <TaskInput
            placeholder="Task"
            value={task}
            onChange={(v) => {
              setTask(v);
              onTaskChange?.(v);
            }}
            project={project}
            onProjectSelect={(p) => {
              setProject(p);
              onProjectChange?.(p);
            }}
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
      )}

      {showComment ? (
        <Textarea
          value={currentComment}
          onChange={(e) => onCommentChange(e.target.value)}
          placeholder="Add a comment..."
          className="resize-none text-sm"
          rows={2}
        />
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="w-fit gap-1.5 text-muted-foreground"
          onClick={() => setShowComment(true)}
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          Add comment
        </Button>
      )}
    </div>
  );
}
