'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Timer } from '@/components/timer/timer';
import { EntriesTable } from '@/components/entries/entries-table';
import { ManualEntryForm } from '@/components/entries/manual-entry-form';
import { WeeklyHoursChart } from '@/components/charts/weekly-hours-chart';
import { ProjectDistributionChart } from '@/components/charts/project-distribution-chart';
import { WeeklyTotal } from '@/components/shared/weekly-total';
import { WeekSelector } from '@/components/shared/week-selector';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import { DashboardErrorState } from '@/components/shared/dashboard-error-state';
import { useWeekEntries } from '@/hooks/use-week-entries';
import { AllocationComparisonCard } from '@/components/allocation';
import {
  buildDailyHoursData,
  buildProjectDistributionData,
} from '@/lib/chart-utils';
import { cn } from '@/lib/utils';

export default function DashboardPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const { data, isLoading, isFetching, isPlaceholderData, error, refetch } =
    useWeekEntries(weekOffset);
  const [filterProject, setFilterProject] = useState<string | undefined>();

  if (!data && isLoading) return <LoadingSpinner />;

  if (error && !data) {
    return <DashboardErrorState error={error} onRetry={() => refetch()} />;
  }

  const entries = data?.entries ?? [];
  const totalHours = data?.totalHours ?? 0;
  const dailyData = buildDailyHoursData(entries);
  const projectData = buildProjectDistributionData(entries);

  return (
    <div
      className={cn(
        'space-y-6',
        isPlaceholderData && 'opacity-60 transition-opacity',
      )}
    >
      <Timer />

      <div className="grid gap-6 md:grid-cols-2">
        <WeeklyHoursChart data={dailyData} />
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
          <div className="flex items-center gap-3">
            <WeeklyTotal totalHours={totalHours} />
            <ManualEntryForm />
          </div>
        </div>
        <EntriesTable
          entries={entries}
          filterProject={filterProject}
          editable={weekOffset === 0}
        />
      </div>
    </div>
  );
}
