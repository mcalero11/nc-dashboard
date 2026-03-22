'use client';

import Link from 'next/link';
import { AlertCircle, RefreshCw, Settings } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';

interface DashboardErrorStateProps {
  error: Error;
  onRetry: () => void;
}

export function DashboardErrorState({
  error,
  onRetry,
}: DashboardErrorStateProps) {
  const isSheetError =
    error instanceof ApiError &&
    error.statusCode === 400 &&
    error.message.toLowerCase().includes('spreadsheet');

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <div>
          <h3 className="font-semibold">
            {isSheetError
              ? 'Timesheet not accessible'
              : 'Failed to load time entries'}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">{error.message}</p>
        </div>
        <div className="flex gap-2">
          {isSheetError ? (
            <Button
              size="sm"
              nativeButton={false}
              render={<Link href="/setup" />}
            >
              <Settings className="mr-2 h-4 w-4" />
              Reconnect Sheet
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
