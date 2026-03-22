'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useDeleteEntry } from '@/hooks/use-delete-entry';
import { usePendingSync } from '@/hooks/use-pending-sync';
import { toast } from 'sonner';

interface DeleteEntryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rowIndex: number;
}

export function DeleteEntryDialog({
  open,
  onOpenChange,
  rowIndex,
}: DeleteEntryDialogProps) {
  const deleteEntry = useDeleteEntry();
  const { addJob } = usePendingSync();

  async function handleDelete() {
    try {
      const result = await deleteEntry.mutateAsync(rowIndex);
      addJob({
        jobId: result.jobId,
        rowIndex,
        operation: 'delete',
        label: 'Entry deleted',
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to delete entry',
      );
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Entry</DialogTitle>
          <DialogDescription>
            This will permanently delete this time entry from your sheet. This
            action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteEntry.isPending}
          >
            {deleteEntry.isPending ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
