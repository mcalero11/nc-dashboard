'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  OpsAllocationsResponse,
  RemoveOpsAliasRequest,
  RemoveOpsAliasResponse,
  SaveOpsAliasRequest,
  SaveOpsAliasResponse,
} from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useAllocations() {
  return useQuery<OpsAllocationsResponse>({
    queryKey: QUERY_KEYS.opsAllocations,
    queryFn: () =>
      apiFetch<OpsAllocationsResponse>(
        API_PATHS.RESOURCE_ALLOCATION_ALLOCATIONS,
      ),
    staleTime: STALE_TIMES.ALLOCATIONS,
    placeholderData: keepPreviousData,
  });
}

export function useSaveOpsAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alias: string) =>
      apiFetch<SaveOpsAliasResponse>(API_PATHS.RESOURCE_ALLOCATION_ALIASES, {
        method: 'POST',
        body: JSON.stringify({ alias } satisfies SaveOpsAliasRequest),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opsAllocations });
    },
  });
}

export function useRemoveOpsAlias() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (alias: string) =>
      apiFetch<RemoveOpsAliasResponse>(API_PATHS.RESOURCE_ALLOCATION_ALIASES, {
        method: 'DELETE',
        body: JSON.stringify({ alias } satisfies RemoveOpsAliasRequest),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.opsAllocations });
    },
  });
}
