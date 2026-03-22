export const SHEET_SYNC_QUEUE = 'sheet-sync';

export interface SheetSyncJobPayload {
  type: 'append' | 'update' | 'clear';
  userId: string;
  spreadsheetId: string;
  rowIndex?: number;
  row?: [string, string, string, number, string];
}
