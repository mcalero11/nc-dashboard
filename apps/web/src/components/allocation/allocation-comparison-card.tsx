'use client';

import { useState, useEffect } from 'react';
import type { TimeEntry } from '@nc-dashboard/shared';
import {
  useAllocations,
  useRemoveOpsAlias,
  useSaveOpsAlias,
} from '@/hooks/use-allocations';
import { useOpsAccessStatus, useCheckOpsAccess } from '@/hooks/use-ops-access';
import {
  buildComparisonData,
  type AllocationComparisonItem,
  type AllocationStatus,
} from '@/lib/chart-utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Trash2 } from 'lucide-react';
import { addWeeks, parseISO, format } from 'date-fns';

interface AllocationComparisonCardProps {
  entries: TimeEntry[];
  weekOffset: number;
}

const STATUS_COLORS: Record<AllocationStatus, string> = {
  'on-track': 'bg-emerald-500',
  approaching: 'bg-amber-500',
  'at-budget': 'bg-sky-500',
  'slightly-over': 'bg-orange-500',
  'over-budget': 'bg-destructive',
  untracked: 'bg-muted-foreground/40',
};

const STATUS_LABELS: Record<AllocationStatus, string> = {
  'on-track': 'On Track',
  approaching: 'Approaching',
  'at-budget': 'At Budget',
  'slightly-over': 'Slightly Over',
  'over-budget': 'Over Budget',
  untracked: 'Not in OPS',
};

function getWeekDate(currentWeekDate: string, weekOffset: number): string {
  if (weekOffset === 0) return currentWeekDate;
  return format(addWeeks(parseISO(currentWeekDate), weekOffset), 'yyyy-MM-dd');
}

function ProgressRow({ item }: { item: AllocationComparisonItem }) {
  const barPct =
    item.allocatedHours > 0
      ? Math.min((item.actualHours / item.allocatedHours) * 100, 100)
      : item.actualHours > 0
        ? 100
        : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="truncate font-medium">{item.project}</span>
        <div className="flex shrink-0 items-center gap-2">
          {item.status === 'untracked' ? (
            <span className="text-muted-foreground">{item.actualHours}h</span>
          ) : (
            <span className="text-muted-foreground">
              {item.actualHours}/{item.allocatedHours}h
            </span>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge
                  variant={
                    item.status === 'over-budget' ? 'destructive' : 'secondary'
                  }
                  className={
                    item.status === 'slightly-over'
                      ? 'border-orange-200 bg-orange-50 text-[10px] text-orange-700'
                      : 'text-[10px]'
                  }
                >
                  {item.status === 'untracked'
                    ? 'not in OPS'
                    : `${item.utilizationPct}%`}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{STATUS_LABELS[item.status]}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${STATUS_COLORS[item.status]}`}
          style={{ width: `${barPct}%` }}
        />
      </div>
    </div>
  );
}

function IdentitySelectionCard({
  candidates,
  onConfirm,
  isPending,
}: {
  candidates: string[];
  onConfirm: (alias: string) => void;
  isPending: boolean;
}) {
  const [selectedCandidate, setSelectedCandidate] = useState(
    candidates[0] ?? '',
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation vs Actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          We found possible matches for your OPS name. Pick the one that belongs
          to you and we&apos;ll remember it for future visits.
        </p>
        <Select
          value={selectedCandidate}
          onValueChange={(value) => setSelectedCandidate(value ?? '')}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select your OPS name" />
          </SelectTrigger>
          <SelectContent align="start" className="w-full min-w-72">
            {candidates.map((candidate) => (
              <SelectItem key={candidate} value={candidate}>
                {candidate}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          onClick={() => onConfirm(selectedCandidate)}
          disabled={!selectedCandidate || isPending}
        >
          {isPending ? 'Saving...' : 'Use This Name'}
        </Button>
      </CardContent>
    </Card>
  );
}

function AliasManagerDialog({
  open,
  onOpenChange,
  aliases,
  activeNames,
  onRemove,
  isPending,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aliases?: string[];
  activeNames?: string[];
  onRemove: (alias: string) => void;
  isPending: boolean;
}) {
  const safeAliases = aliases ?? [];
  const safeActiveNames = activeNames ?? [];
  const isLastAlias = safeAliases.length === 1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage OPS Names</DialogTitle>
          <DialogDescription>
            Remove saved OPS aliases if they are outdated. If you remove the
            active alias, allocation matching will re-resolve automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          {safeAliases.length > 0 ? (
            safeAliases.map((alias) => {
              const isActive = safeActiveNames.includes(alias);

              return (
                <div
                  key={alias}
                  className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{alias}</p>
                    <p className="text-xs text-muted-foreground">
                      {isActive ? 'Currently matched' : 'Saved alias'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onRemove(alias)}
                    disabled={isPending}
                    title={`Remove ${alias}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground">
              No saved aliases yet. If you ever pick an OPS name from the
              fallback list, it will appear here.
            </p>
          )}
          {isLastAlias && safeAliases.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Removing the last alias may send you back to the name selection
              flow if your Google name does not resolve on its own.
            </p>
          ) : null}
        </div>
        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function AllocationSkeletonCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation vs Actual</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </CardContent>
    </Card>
  );
}

export function AllocationComparisonCard(props: AllocationComparisonCardProps) {
  const { data: accessData, isLoading: isAccessLoading } = useOpsAccessStatus();
  const checkAccess = useCheckOpsAccess();

  const isUnchecked = accessData?.access === 'unchecked';

  useEffect(() => {
    if (isUnchecked && !checkAccess.isPending) {
      checkAccess.mutate();
    }
    // Only trigger when access status changes to unchecked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnchecked]);

  if (isAccessLoading || isUnchecked || checkAccess.isPending) {
    return <AllocationSkeletonCard />;
  }

  if (accessData?.access === 'no_access') {
    return null;
  }

  return <AllocationComparisonCardInner {...props} />;
}

function AllocationComparisonCardInner({
  entries,
  weekOffset,
}: AllocationComparisonCardProps) {
  const { data: allocData, isLoading } = useAllocations();
  const saveAlias = useSaveOpsAlias();
  const removeAlias = useRemoveOpsAlias();
  const [isAliasDialogOpen, setIsAliasDialogOpen] = useState(false);

  if (isLoading) {
    return <AllocationSkeletonCard />;
  }

  if (!allocData) return null;

  if (allocData.status === 'ambiguous') {
    return (
      <IdentitySelectionCard
        key={allocData.candidatePersonNames.join(',')}
        candidates={allocData.candidatePersonNames}
        onConfirm={(alias) => saveAlias.mutate(alias)}
        isPending={saveAlias.isPending}
      />
    );
  }

  if (allocData.status === 'no_match') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            {allocData.lastSyncAt
              ? 'We could not match your account to a person in the OPS allocation sheet.'
              : 'No synced OPS allocation data is available yet.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  const weekDate = getWeekDate(allocData.currentWeekDate, weekOffset);
  const comparison = buildComparisonData(
    entries,
    allocData.allocations,
    weekDate,
  );

  if (!comparison) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Allocation vs Actual</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-sm text-muted-foreground">
            No allocations for this week
          </p>
        </CardContent>
      </Card>
    );
  }

  const currentMatchedName = allocData.matchedPersonNames[0] ?? null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div className="space-y-2">
          <CardTitle>Allocation vs Actual</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            {currentMatchedName ? (
              <Badge variant="secondary">Using: {currentMatchedName}</Badge>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAliasDialogOpen(true)}
            >
              Manage
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-3 text-sm">
          <div className="rounded-md bg-muted px-3 py-1.5">
            <span className="font-semibold">{comparison.totalAllocated}h</span>{' '}
            <span className="text-muted-foreground">allocated</span>
          </div>
          <div className="rounded-md bg-muted px-3 py-1.5">
            <span className="font-semibold">{comparison.totalActual}h</span>{' '}
            <span className="text-muted-foreground">actual</span>
          </div>
          <div className="rounded-md bg-muted px-3 py-1.5">
            <span className="font-semibold">
              {comparison.overallUtilization}%
            </span>{' '}
            <span className="text-muted-foreground">utilization</span>
          </div>
        </div>

        <div className="space-y-3">
          {comparison.items.map((item) => (
            <ProgressRow key={item.project} item={item} />
          ))}
        </div>
      </CardContent>
      <AliasManagerDialog
        open={isAliasDialogOpen}
        onOpenChange={setIsAliasDialogOpen}
        aliases={allocData.savedAliases ?? []}
        activeNames={allocData.matchedPersonNames ?? []}
        onRemove={(alias) => removeAlias.mutate(alias)}
        isPending={removeAlias.isPending}
      />
    </Card>
  );
}
