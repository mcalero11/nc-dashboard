'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import type { WeekEntriesResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, STALE_TIMES } from '@/lib/constants';

export function useWeekEntries(weekOffset = 0) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const url = `${API_PATHS.TIME_ENTRIES_WEEK}?weekOffset=${weekOffset}&timezone=${encodeURIComponent(tz)}`;
  return useQuery<WeekEntriesResponse>({
    queryKey: QUERY_KEYS.weekEntries(weekOffset),
    queryFn: () => apiFetch<WeekEntriesResponse>(url),
    staleTime: weekOffset === 0 ? STALE_TIMES.WEEK_ENTRIES : Infinity,
    refetchOnWindowFocus: weekOffset === 0,
    placeholderData: keepPreviousData,
  });
}
