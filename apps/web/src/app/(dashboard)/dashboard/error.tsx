'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw, Settings } from 'lucide-react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const isSheetError =
    error.message?.toLowerCase().includes('spreadsheet') ||
    error.message?.toLowerCase().includes('sheet');

  return (
    <div className="flex items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <div>
            <h2 className="text-lg font-semibold">Something went wrong</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {error.message || 'An unexpected error occurred.'}
            </p>
          </div>
        </CardContent>
        <CardFooter className="justify-center gap-2">
          <Button variant="outline" onClick={() => unstable_retry()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Try again
          </Button>
          {isSheetError && (
            <Button
              variant="default"
              nativeButton={false}
              render={<Link href="/setup" />}
            >
              <Settings className="mr-2 h-4 w-4" />
              Sheet Settings
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
