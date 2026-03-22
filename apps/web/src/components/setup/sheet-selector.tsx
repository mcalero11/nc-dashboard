'use client';

import { format } from 'date-fns';
import type { SheetInfo } from '@nc-dashboard/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FileSpreadsheet } from 'lucide-react';

interface SheetSelectorProps {
  sheets: SheetInfo[];
  onSelect: (id: string) => void;
  isSelecting: boolean;
}

export function SheetSelector({
  sheets,
  onSelect,
  isSelecting,
}: SheetSelectorProps) {
  if (sheets.length === 0) return null;

  return (
    <div className="grid gap-3">
      {sheets.map((sheet) => (
        <Card
          key={sheet.id}
          className="cursor-pointer transition-colors hover:bg-accent"
        >
          <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm">{sheet.name}</CardTitle>
                <Badge variant={sheet.ownedByMe ? 'default' : 'secondary'}>
                  {sheet.ownedByMe ? 'Owner' : 'Shared'}
                </Badge>
              </div>
              <CardDescription className="text-xs">
                Last modified:{' '}
                {format(new Date(sheet.modifiedTime), 'MMM d, yyyy')}
              </CardDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onSelect(sheet.id)}
              disabled={isSelecting}
            >
              Select
            </Button>
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
