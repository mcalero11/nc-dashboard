'use client';

import { useQuery } from '@tanstack/react-query';
import type { TaskSummaryResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useTaskSummary(task: string | null) {
  const url = `${API_PATHS.TASK_SUMMARY}?task=${encodeURIComponent(task ?? '')}`;
  return useQuery<TaskSummaryResponse>({
    queryKey: QUERY_KEYS.taskSummary(task ?? ''),
    queryFn: () => apiFetch<TaskSummaryResponse>(url),
    enabled: !!task,
    staleTime: STALE_TIMES.TASK_SUMMARY,
  });
}
