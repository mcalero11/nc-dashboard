'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ProjectDistributionData } from '@/lib/chart-utils';

interface ProjectDistributionChartProps {
  data: ProjectDistributionData[];
  onProjectClick?: (project: string) => void;
}

export function ProjectDistributionChart({
  data,
  onProjectClick,
}: ProjectDistributionChartProps) {
  const totalHours = data.reduce((sum, entry) => sum + entry.hours, 0);
  const formatPercent = (hours: number) =>
    totalHours > 0 ? `${((hours / totalHours) * 100).toFixed(1)}%` : '0%';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Hours by Project</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">
            No data
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="hours"
                  nameKey="project"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  onClick={(d) => onProjectClick?.(d.project)}
                  className="cursor-pointer"
                >
                  {data.map((entry) => (
                    <Cell key={entry.project} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: 'var(--color-popover)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                  formatter={(value: number) => [
                    `${Number.isInteger(value) ? value : parseFloat(value.toFixed(2))}h (${formatPercent(value)})`,
                    '',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {data.map((entry) => (
                <div
                  key={entry.project}
                  className="flex items-center gap-1.5 text-sm"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: entry.fill }}
                  />
                  <span
                    className="text-muted-foreground truncate max-w-[120px]"
                    title={entry.project}
                  >
                    {entry.project}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
