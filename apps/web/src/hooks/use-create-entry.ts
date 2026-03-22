'use client';

import { useMutation } from '@tanstack/react-query';
import type { CreateTimeEntryRequest } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/constants';

export function useCreateEntry() {
  return useMutation({
    mutationFn: (data: CreateTimeEntryRequest) =>
      apiFetch<{ jobId: string }>(API_PATHS.TIME_ENTRIES, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
  });
}
