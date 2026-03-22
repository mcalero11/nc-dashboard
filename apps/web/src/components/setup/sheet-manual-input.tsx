'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SheetManualInputProps {
  onSubmit: (spreadsheetId: string) => void;
  isSubmitting: boolean;
}

export function SheetManualInput({
  onSubmit,
  isSubmitting,
}: SheetManualInputProps) {
  const [value, setValue] = useState('');

  return (
    <div className="flex flex-col gap-3">
      <Label htmlFor="spreadsheet-id">Google Sheet URL or ID</Label>
      <div className="flex gap-2">
        <Input
          id="spreadsheet-id"
          placeholder="Paste a Google Sheets URL or spreadsheet ID"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button
          onClick={() => onSubmit(value.trim())}
          disabled={!value.trim() || isSubmitting}
        >
          {isSubmitting ? 'Connecting...' : 'Connect'}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        You can find this in the URL of your Google Sheet:
        docs.google.com/spreadsheets/d/<strong>spreadsheet-id</strong>/edit
      </p>
    </div>
  );
}
