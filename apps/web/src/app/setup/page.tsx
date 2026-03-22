'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { SheetDiscovery } from '@/components/setup/sheet-discovery';
import { SheetSelector } from '@/components/setup/sheet-selector';
import { SheetManualInput } from '@/components/setup/sheet-manual-input';
import { useSheetDiscovery } from '@/hooks/use-sheet-discovery';

export default function SetupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get('from');
  const {
    sheets,
    isLoading,
    error,
    discover,
    selectSheet,
    autoSelected,
    selectedSpreadsheetId,
  } = useSheetDiscovery();
  const [isSelecting, setIsSelecting] = useState(false);
  const [hasDiscovered, setHasDiscovered] = useState(false);

  const isChanging = from === 'dashboard';

  // Auto-trigger discovery on mount
  useEffect(() => {
    discover(isChanging ? { skipAutoSelect: true } : undefined).then(() =>
      setHasDiscovered(true),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle auto-selection redirect (skip when user is changing sheets)
  useEffect(() => {
    if (autoSelected && selectedSpreadsheetId && !isChanging) {
      toast.success('Timesheet found and connected automatically!');
      router.push('/dashboard');
      router.refresh();
    }
  }, [autoSelected, selectedSpreadsheetId, router, isChanging]);

  async function handleSelect(spreadsheetId: string) {
    setIsSelecting(true);
    try {
      await selectSheet(spreadsheetId);
      toast.success('Sheet connected successfully!');
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to connect sheet',
      );
    } finally {
      setIsSelecting(false);
    }
  }

  const showManualInput =
    hasDiscovered && !isLoading && (sheets.length === 0 || isChanging);
  const showSelector = hasDiscovered && !isLoading && sheets.length >= 1;

  return (
    <div className="w-full max-w-lg space-y-4">
      {from === 'dashboard' && (
        <Button
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/dashboard" />}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      )}
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Connect Your Timesheet</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Searching for your timesheet...'
              : isChanging && sheets.length > 0
                ? `Found ${sheets.length} timesheet${sheets.length > 1 ? 's' : ''}. Select one or paste a different URL below.`
                : showManualInput
                  ? 'No timesheets found. Please paste your Google Sheet URL below.'
                  : showSelector
                    ? `Found ${sheets.length} timesheets. Please select the correct one.`
                    : 'Setting up your time tracking sheet.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <SheetDiscovery onDiscover={discover} isLoading={isLoading} />

          {error && <p className="text-sm text-destructive">{error}</p>}

          {showSelector && (
            <SheetSelector
              sheets={sheets}
              onSelect={handleSelect}
              isSelecting={isSelecting}
            />
          )}

          {showManualInput && (
            <SheetManualInput
              onSubmit={handleSelect}
              isSubmitting={isSelecting}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
