'use client';

import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyHoursData } from '@/lib/chart-utils';

const WEEKEND_DAYS = new Set(['Sat', 'Sun']);

function getBarColor(day: string, hours: number): string {
  // Weekend with no logged hours — mid-tone slate, safe in light and dark mode
  if (hours === 0 && WEEKEND_DAYS.has(day)) return 'hsl(220, 10%, 60%)';

  // Overtime ramp: coral-orange at 8.5h → muted crimson at 12h+
  if (hours > 8.5) {
    const ratio = Math.min(1, (hours - 8.5) / 3.5);
    const hue = Math.round(15 - ratio * 15); // 15 → 0
    const saturation = Math.round(52 + ratio * 10); // 52 → 62
    const lightness = Math.round(58 - ratio * 13); // 58 → 45
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
  }

  // On target (7.5–8.5h): muted sage-teal
  if (hours >= 7.5) return 'hsl(158, 48%, 46%)';

  // Approaching target (6–7.49h): calm cyan-blue
  if (hours >= 6) return 'hsl(199, 52%, 52%)';

  // Undertime (< 6h, including 0h weekdays): muted amber
  return 'hsl(38, 55%, 58%)';
}

interface WeeklyHoursChartProps {
  data: DailyHoursData[];
  trendByDay?: Record<string, number>;
  showTrend?: boolean;
}

export function WeeklyHoursChart({
  data,
  trendByDay,
  showTrend,
}: WeeklyHoursChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    trend: showTrend && trendByDay ? (trendByDay[d.day] ?? null) : undefined,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="day"
                className="text-xs"
                tick={{ fill: 'var(--color-muted-foreground)' }}
              />
              <YAxis
                className="text-xs"
                tick={{ fill: 'var(--color-muted-foreground)' }}
              />
              <Tooltip
                contentStyle={{
                  background: 'var(--color-popover)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)',
                }}
                labelStyle={{ color: 'var(--color-popover-foreground)' }}
                formatter={(value: number, name: string) => {
                  if (name === 'trend')
                    return [`${value.toFixed(2)}h avg`, 'Trend'];
                  return [`${value}h`, 'Hours'];
                }}
              />
              <Bar dataKey="hours" radius={[4, 4, 0, 0]}>
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(entry.day, entry.hours)}
                  />
                ))}
              </Bar>
              {showTrend && trendByDay && (
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="hsl(262, 83%, 58%)"
                  strokeWidth={2}
                  strokeDasharray="4 2"
                  dot={{ r: 3, fill: 'hsl(262, 83%, 58%)' }}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
