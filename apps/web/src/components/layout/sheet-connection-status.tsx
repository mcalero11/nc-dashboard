'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { badgeVariants } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Check,
  ExternalLink,
  FileSpreadsheet,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSheetStatus } from '@/hooks/use-sheet-status';

const ERROR_LABELS: Record<string, string> = {
  not_configured: 'No sheet configured',
  access_denied: 'Access denied',
  not_found: 'Sheet not found',
  token_error: 'Authentication error',
  unknown: 'Connection error',
};

export function SheetConnectionStatus() {
  const { data, isLoading, isError, refetch } = useSheetStatus();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <span
        className={cn(
          badgeVariants({ variant: 'outline' }),
          'transition-all duration-200',
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span className="hidden sm:inline">Checking...</span>
      </span>
    );
  }

  if (isError) {
    return (
      <button
        onClick={() => refetch()}
        className={cn(
          badgeVariants({ variant: 'destructive' }),
          'cursor-pointer transition-all duration-200',
        )}
      >
        <AlertCircle className="h-3 w-3" />
        <span className="hidden sm:inline">Connection error</span>
      </button>
    );
  }

  if (!data) return null;

  const { connected, spreadsheetId, sheetName, error } = data;

  const badgeContent = connected ? (
    <>
      <Check className="h-3 w-3" />
      <span className="hidden sm:inline max-w-[120px] truncate">
        {sheetName ?? 'Connected'}
      </span>
    </>
  ) : error === 'not_configured' ? (
    <>
      <FileSpreadsheet className="h-3 w-3" />
      <span className="hidden sm:inline">No sheet</span>
    </>
  ) : (
    <>
      <AlertCircle className="h-3 w-3" />
      <span className="hidden sm:inline">
        {ERROR_LABELS[error ?? 'unknown']}
      </span>
    </>
  );

  const variant = connected
    ? ('default' as const)
    : error === 'not_configured'
      ? ('outline' as const)
      : ('destructive' as const);

  return (
    <TooltipProvider>
      <Dialog open={open} onOpenChange={setOpen}>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                className={cn(
                  badgeVariants({ variant }),
                  'cursor-pointer transition-all duration-200',
                )}
                onClick={() => setOpen(true)}
              />
            }
          >
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent>
            {connected
              ? (sheetName ?? 'Sheet connected')
              : ERROR_LABELS[error ?? 'unknown']}
          </TooltipContent>
        </Tooltip>

        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sheet Connection</DialogTitle>
            <DialogDescription>
              {connected
                ? 'Your timesheet is connected and working.'
                : ERROR_LABELS[error ?? 'unknown']}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {sheetName && (
              <div>
                <p className="text-xs text-muted-foreground">Sheet name</p>
                <p className="text-sm font-medium">{sheetName}</p>
              </div>
            )}
            {spreadsheetId && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">
                    Spreadsheet ID
                  </p>
                  <p className="text-sm font-mono break-all">{spreadsheetId}</p>
                </div>
                <a
                  href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  Open in Google Sheets
                  <ExternalLink className="h-3 w-3" />
                </a>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetch();
              }}
            >
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
              Retry
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setOpen(false);
                router.push('/setup?from=dashboard');
              }}
            >
              <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" />
              Change Sheet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
