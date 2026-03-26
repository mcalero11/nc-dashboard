'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateTimeEntryRequest } from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS } from '@/lib/constants';
import { prependRecentTask } from '@/lib/query-utils';

export function useCreateEntry() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTimeEntryRequest) =>
      apiFetch<{ jobId: string }>(API_PATHS.TIME_ENTRIES, {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: (_result, variables) => {
      const task = variables.task?.trim();
      if (task) {
        prependRecentTask(queryClient, { task, project: variables.project });
      }
    },
  });
}
