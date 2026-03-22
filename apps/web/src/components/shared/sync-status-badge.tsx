'use client';

import { Badge } from '@/components/ui/badge';
import type { JobStatusResponse } from '@nc-dashboard/shared';

interface SyncStatusBadgeProps {
  status: JobStatusResponse['status'] | null;
}

const variants: Record<
  string,
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  completed: 'default',
  active: 'secondary',
  waiting: 'outline',
  failed: 'destructive',
  delayed: 'outline',
  paused: 'outline',
};

export function SyncStatusBadge({ status }: SyncStatusBadgeProps) {
  if (!status) return null;

  return (
    <Badge variant={variants[status] ?? 'outline'} className="text-xs">
      {status === 'active' ? 'Syncing...' : status}
    </Badge>
  );
}
