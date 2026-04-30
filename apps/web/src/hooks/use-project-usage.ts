'use client';

import { useQuery } from '@tanstack/react-query';
import type { ProjectUsageResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useProjectUsage() {
  return useQuery<ProjectUsageResponse>({
    queryKey: QUERY_KEYS.projectUsage,
    queryFn: () => apiFetch<ProjectUsageResponse>(API_PATHS.PROJECT_USAGE),
    staleTime: STALE_TIMES.PROJECT_USAGE,
  });
}
