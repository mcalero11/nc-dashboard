'use client';

import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw } from 'lucide-react';

interface SheetDiscoveryProps {
  onDiscover: () => void;
  isLoading: boolean;
}

export function SheetDiscovery({ onDiscover, isLoading }: SheetDiscoveryProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Searching for your timesheet...
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={onDiscover}
        className="gap-2"
      >
        <RefreshCw className="h-4 w-4" />
        Retry Search
      </Button>
    </div>
  );
}
