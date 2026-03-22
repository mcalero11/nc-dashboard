'use client';

import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/constants';

export function useDeleteEntry() {
  return useMutation({
    mutationFn: (rowIndex: number) =>
      apiFetch<{ jobId: string }>(API_PATHS.TIME_ENTRY(rowIndex), {
        method: 'DELETE',
      }),
  });
}
