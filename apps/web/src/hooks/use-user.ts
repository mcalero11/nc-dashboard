'use client';

import { useQuery } from '@tanstack/react-query';
import type { JwtPayload } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useUser() {
  return useQuery<JwtPayload>({
    queryKey: QUERY_KEYS.user,
    queryFn: () => apiFetch<JwtPayload>(API_PATHS.AUTH_ME),
    staleTime: STALE_TIMES.USER,
  });
}
