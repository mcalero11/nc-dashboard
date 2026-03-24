'use client';

import { useQuery } from '@tanstack/react-query';
import type { RecentTasksResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useRecentTasks() {
  return useQuery<RecentTasksResponse>({
    queryKey: QUERY_KEYS.recentTasks,
    queryFn: () => apiFetch<RecentTasksResponse>(API_PATHS.RECENT_TASKS),
    staleTime: STALE_TIMES.RECENT_TASKS,
  });
}
