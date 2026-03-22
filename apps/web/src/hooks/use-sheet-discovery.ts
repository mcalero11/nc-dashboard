'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  SheetInfo,
  SheetDiscoveryResponse,
  SelectSheetResponse,
} from '@nc-dashboard/shared';
import { apiFetch } from '@/lib/api';
import { API_PATHS, QUERY_KEYS } from '@/lib/constants';

export function useSheetDiscovery() {
  const queryClient = useQueryClient();
  const [sheets, setSheets] = useState<SheetInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [selectedSpreadsheetId, setSelectedSpreadsheetId] = useState<
    string | null
  >(null);

  async function discover(options?: { skipAutoSelect?: boolean }) {
    setIsLoading(true);
    setError(null);
    setAutoSelected(false);
    setSelectedSpreadsheetId(null);
    try {
      const url = options?.skipAutoSelect
        ? `${API_PATHS.SHEETS_DISCOVER}?skipAutoSelect=true`
        : API_PATHS.SHEETS_DISCOVER;
      const data = await apiFetch<SheetDiscoveryResponse>(url);
      setSheets(data.sheets);
      setAutoSelected(data.autoSelected);
      setSelectedSpreadsheetId(data.spreadsheetId);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to discover sheets',
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function selectSheet(spreadsheetId: string) {
    const result = await apiFetch<SelectSheetResponse>(
      API_PATHS.SHEETS_SELECT,
      {
        method: 'PATCH',
        body: JSON.stringify({ spreadsheetId }),
      },
    );

    // Clear all sheet-dependent caches so the new sheet's data loads fresh
    queryClient.removeQueries({ queryKey: QUERY_KEYS.weekEntries() });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.projects });
    queryClient.removeQueries({ queryKey: QUERY_KEYS.sheetStatus });

    return result;
  }

  return {
    sheets,
    isLoading,
    error,
    discover,
    selectSheet,
    autoSelected,
    selectedSpreadsheetId,
  };
}
