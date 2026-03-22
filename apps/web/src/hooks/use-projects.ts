'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectsResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useProjects() {
  return useQuery<ProjectsResponse>({
    queryKey: QUERY_KEYS.projects,
    queryFn: () => apiFetch<ProjectsResponse>(API_PATHS.SHEETS_PROJECTS),
    staleTime: STALE_TIMES.PROJECTS,
  });
}

export function useRefreshProjects() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.projects });
}
