'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { OpsAccessStatusResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useOpsAccessStatus() {
  return useQuery<OpsAccessStatusResponse>({
    queryKey: QUERY_KEYS.opsAccessStatus,
    queryFn: () =>
      apiFetch<OpsAccessStatusResponse>(
        API_PATHS.RESOURCE_ALLOCATION_ACCESS_STATUS,
      ),
    staleTime: STALE_TIMES.OPS_ACCESS_STATUS,
  });
}

export function useCheckOpsAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () =>
      apiFetch<OpsAccessStatusResponse>(
        API_PATHS.RESOURCE_ALLOCATION_CHECK_ACCESS,
        { method: 'POST' },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.opsAccessStatus, data);
      if (data.access === 'has_access') {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opsAllocations });
      }
    },
  });
}
