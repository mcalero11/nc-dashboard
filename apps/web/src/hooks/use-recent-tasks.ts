'use client';

import { useQuery } from '@tanstack/react-query';
import type { RecentTasksResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useRecentTasks(project?: string) {
  const url = project
    ? `${API_PATHS.RECENT_TASKS}?project=${encodeURIComponent(project)}`
    : API_PATHS.RECENT_TASKS;

  return useQuery<RecentTasksResponse>({
    queryKey: QUERY_KEYS.recentTasks(project),
    queryFn: () => apiFetch<RecentTasksResponse>(url),
    staleTime: STALE_TIMES.RECENT_TASKS,
  });
}
