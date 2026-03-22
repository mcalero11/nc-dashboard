'use client';

import { useContext } from 'react';
import { PendingSyncContext } from '@/providers/pending-sync-provider';

export function usePendingSync() {
  const ctx = useContext(PendingSyncContext);
  if (!ctx) {
    throw new Error('usePendingSync must be used within PendingSyncProvider');
  }
  return ctx;
}
