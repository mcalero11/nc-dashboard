'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { RecentTasksResponse } from '@nc-dashboard/shared';
import { QUERY_KEYS } from '@/lib/constants';

export function prependRecentTask(
  queryClient: QueryClient,
  task: string,
  project?: string,
) {
  const update = (key: readonly string[]) => {
    queryClient.setQueryData<RecentTasksResponse>(key, (old) => {
      const tasks = old?.tasks ?? [];
      if (tasks.some((t) => t.toLowerCase() === task.toLowerCase())) return old;
      return { tasks: [task, ...tasks].slice(0, 10) };
    });
  };
  update(QUERY_KEYS.recentTasks());
  if (project) update(QUERY_KEYS.recentTasks(project));
}