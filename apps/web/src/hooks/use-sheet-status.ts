'use client';

import { useQuery } from '@tanstack/react-query';
import type { SheetStatusResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useSheetStatus() {
  return useQuery<SheetStatusResponse>({
    queryKey: QUERY_KEYS.sheetStatus,
    queryFn: () => apiFetch<SheetStatusResponse>(API_PATHS.SHEETS_STATUS),
    staleTime: STALE_TIMES.SHEET_STATUS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
