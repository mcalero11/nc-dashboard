'use client';

import type { QueryClient } from '@tanstack/react-query';
import type { RecentTasksResponse } from '@nc-dashboard/shared';
import { QUERY_KEYS } from '@/lib/constants';

export function prependRecentTask(
  queryClient: QueryClient,
  entry: { task: string; project: string },
) {
  const update = (key: readonly string[]) => {
    queryClient.setQueryData<RecentTasksResponse>(key, (old) => {
      const tasks = old?.tasks ?? [];
      if (tasks.some((t) => t.task.toLowerCase() === entry.task.toLowerCase()))
        return old;
      return { tasks: [entry, ...tasks].slice(0, 10) };
    });
  };
  update(QUERY_KEYS.recentTasks());
  if (entry.project) update(QUERY_KEYS.recentTasks(entry.project));
}
