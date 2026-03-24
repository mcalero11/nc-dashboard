'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { UpdateTimeEntryRequest } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/constants';
import { prependRecentTask } from '@/lib/query-utils';

export function useUpdateEntry() {
  const queryClient = useQueryClient();

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
    onSuccess: (_result, variables) => {
      const task = variables.data.task?.trim();
      if (task) {
        prependRecentTask(queryClient, task, variables.data.project);
      }
    },
  });
}
