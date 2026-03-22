'use client';

import { useMutation } from '@tanstack/react-query';
import type { UpdateTimeEntryRequest } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/constants';

export function useUpdateEntry() {
  return useMutation({
    mutationFn: ({
      rowIndex,
      data,
    }: {
      rowIndex: number;
      data: UpdateTimeEntryRequest;
    }) =>
      apiFetch<{ jobId: string }>(API_PATHS.TIME_ENTRY(rowIndex), {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
  });
}
