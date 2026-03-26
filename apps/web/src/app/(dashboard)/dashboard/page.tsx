'use client';

import { useState, useMemo, useCallback } from 'react';
import type { TimeEntry } from '@nc-dashboard/shared';
import { Loader2 } from 'lucide-react';
import { TimeEntryCard } from '@/components/timer/time-entry-card';
import { EntriesTable } from '@/components/entries/entries-table';
import { WeeklyHoursChart } from '@/components/charts/weekly-hours-chart';
import { ProjectDistributionChart } from '@/components/charts/project-distribution-chart';
import { WeeklyTotal } from '@/components/shared/weekly-total';
import { WeekSelector } from '@/components/shared/week-selector';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { DashboardErrorState } from '@/components/shared/dashboard-error-state';
import { useWeekEntries } from '@/hooks/use-week-entries';
import { useTrendData } from '@/hooks/use-trend-data';
import { AllocationComparisonCard } from '@/components/allocation';
import {
  buildDailyHoursData,
  buildProjectDistributionData,
} from '@/lib/chart-utils';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS, DAY_ORDER } from '@/lib/constants';

export default function DashboardPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useWeekEntries(weekOffset);
  const [filterProject, setFilterProject] = useState<string | undefined>();
  const [resumeEntry, setResumeEntry] = useState<TimeEntry | null>(null);
  const clearResumeEntry = useCallback(() => setResumeEntry(null), []);

  const { data: healthData } = useQuery({
    queryKey: ['public-config'],
    queryFn: () => apiFetch<{ weeksBehind: number }>(API_PATHS.HEALTH),
    staleTime: 10 * 60 * 1000,
  });
  const weeksBehind = healthData?.weeksBehind ?? 0;
  const { trendByDay } = useTrendData(weeksBehind);

  const filteredTrendByDay = useMemo(() => {
    if (weekOffset !== 0) return trendByDay;
    const todayIndex = (DAY_ORDER as readonly string[]).indexOf(
      format(new Date(), 'EEE'),
    );
    return Object.fromEntries(
      Object.entries(trendByDay).filter(
        ([day]) => (DAY_ORDER as readonly string[]).indexOf(day) <= todayIndex,
      ),
    );
  }, [weekOffset, trendByDay]);

  const entries = useMemo(() => data?.entries ?? [], [data?.entries]);
  const totalHours = data?.totalHours ?? 0;
  const dailyData = buildDailyHoursData(entries);
  const projectData = buildProjectDistributionData(entries);

  const taskTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of entries) {
      if (e.task) map.set(e.task, (map.get(e.task) ?? 0) + e.hours);
    }
    return map;
  }, [entries]);

  if (!data && isLoading) return <LoadingSpinner />;

  if (error && !data) {
    return <DashboardErrorState error={error} onRetry={() => refetch()} />;
  }

  return (
    <div
      className={cn(
        'space-y-6',
        isPlaceholderData && 'opacity-60 transition-opacity',
      )}
    >
      <TimeEntryCard
        resumeEntry={resumeEntry}
        onResumeHandled={clearResumeEntry}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <WeeklyHoursChart
          data={dailyData}
          trendByDay={filteredTrendByDay}
          showTrend={weekOffset === 0 && weeksBehind > 0}
        />
        <ProjectDistributionChart
          data={projectData}
          onProjectClick={(project) =>
            setFilterProject((prev) => (prev === project ? undefined : project))
          }
        />
      </div>

      <AllocationComparisonCard entries={entries} weekOffset={weekOffset} />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <WeekSelector
              weekOffset={weekOffset}
              weekStart={data?.weekStart}
              weekEnd={data?.weekEnd}
              onOffsetChange={setWeekOffset}
            />
            {isFetching && (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            )}
            {filterProject && (
              <button
                className="text-xs text-muted-foreground underline"
                onClick={() => setFilterProject(undefined)}
              >
                Clear filter: {filterProject}
              </button>
            )}
          </div>
          <WeeklyTotal totalHours={totalHours} />
        </div>
        <EntriesTable
          entries={entries}
          filterProject={filterProject}
          editable={weekOffset === 0}
          taskTotals={taskTotals}
          onResume={weekOffset === 0 ? setResumeEntry : undefined}
        />
      </div>
    </div>
  );
}
