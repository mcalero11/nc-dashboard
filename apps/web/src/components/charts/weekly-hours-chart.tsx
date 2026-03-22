'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DailyHoursData } from '@/lib/chart-utils';

interface WeeklyHoursChartProps {
  data: DailyHoursData[];
}

export function WeeklyHoursChart({ data }: WeeklyHoursChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Daily Hours</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[200px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
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
              />
              <Bar
                dataKey="hours"
                fill="hsl(221, 83%, 53%)"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
