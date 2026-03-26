'use client';

import { useQueries } from '@tanstack/react-query';
import type { WeekEntriesResponse } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS, DAY_ORDER } from '@/lib/constants';
import { getDayName } from '@/lib/date-utils';

export function useTrendData(weeksBehind: number): {
  trendByDay: Record<string, number>;
  isLoading: boolean;
} {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const offsets =
    weeksBehind > 0
      ? Array.from({ length: weeksBehind }, (_, i) => -(i + 1))
      : [];

  const results = useQueries({
    queries: offsets.map((offset) => ({
      queryKey: QUERY_KEYS.weekEntries(offset),
      queryFn: () =>
        apiFetch<WeekEntriesResponse>(
          `${API_PATHS.TIME_ENTRIES_WEEK}?weekOffset=${offset}&timezone=${encodeURIComponent(tz)}`,
        ),
      staleTime: Infinity,
      refetchOnWindowFocus: false,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);

  const trendByDay: Record<string, number> = {};

  if (!isLoading && results.length > 0) {
    for (const day of DAY_ORDER) {
      const values: number[] = [];
      for (const result of results) {
        if (!result.data) continue;
        const dayTotal = result.data.entries
          .filter((e) => getDayName(e.date) === day)
          .reduce((sum, e) => sum + e.hours, 0);
        if (dayTotal > 0) values.push(dayTotal);
      }
      if (values.length > 0) {
        trendByDay[day] =
          Math.round(
            (values.reduce((a, b) => a + b, 0) / values.length) * 100,
          ) / 100;
      }
    }
  }

  return { trendByDay, isLoading };
}
