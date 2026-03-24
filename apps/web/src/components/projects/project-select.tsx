'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useProjects, useRefreshProjects } from '@/hooks/use-projects';
import { RefreshCw } from 'lucide-react';

interface ProjectSelectProps {
  value: string;
  onChange: (value: string) => void;
}

export function ProjectSelect({ value, onChange }: ProjectSelectProps) {
  const { data, isLoading, isFetching } = useProjects();
  const refreshProjects = useRefreshProjects();

  const projects = data?.projects ?? [];
  const source = data?.source ?? 'none';

  if (!isLoading && (source === 'none' || projects.length === 0)) {
    return (
      <div className="flex items-center gap-1.5">
        <Input
          placeholder="Project name"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="sm:w-48"
        />
        <p className="text-xs text-amber-600 dark:text-amber-400">
          No project list found in your sheet.
        </p>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={refreshProjects}
          disabled={isFetching}
          title="Refresh projects"
        >
          <RefreshCw className={isFetching ? 'animate-spin' : ''} />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <Select value={value} onValueChange={(v) => onChange(v ?? '')}>
        <SelectTrigger className="sm:w-48">
          <SelectValue
            placeholder={isLoading ? 'Loading...' : 'Select project'}
          />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p} value={p}>
              {p.trim()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={refreshProjects}
        disabled={isFetching}
        title="Refresh projects"
      >
        <RefreshCw className={isFetching ? 'animate-spin' : ''} />
      </Button>
    </div>
  );
}
