import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google } from 'googleapis';

export interface SheetRawData {
  headers: string[];
  staticData: string[][];
  weeklyData: string[][];
  columnCount: number;
}

function columnIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n > 0) {
    const remainder = (n - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

@Injectable()
export class ResourceAllocationSheetsService {
  private readonly logger = new Logger(ResourceAllocationSheetsService.name);

  constructor(private readonly configService: ConfigService) {}

  private getAuth(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  async discoverOpsSheet(
    accessToken: string,
  ): Promise<{ spreadsheetId: string } | null> {
    const sheetName = this.configService.get<string>('OPS_SHEET_NAME')!;
    const auth = this.getAuth(accessToken);
    const drive = google.drive({ version: 'v3', auth });

    const response = await drive.files.list({
      q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: 'files(id, name)',
    });

    const files = response.data.files ?? [];
    this.logger.log(`Discovered ${files.length} OPS sheet(s)`);

    if (files.length === 0) return null;
    return { spreadsheetId: files[0].id! };
  }

  async checkAccess(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<boolean> {
    try {
      const sheets = google.sheets({
        version: 'v4',
        auth: this.getAuth(accessToken),
      });
      await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId',
      });
      return true;
    } catch (error: unknown) {
      const gError = error as { response?: { status?: number }; code?: number };
      const status = gError.response?.status ?? gError.code;
      if (status === 403 || status === 404) {
        return false;
      }
      throw error;
    }
  }

  async readSheetData(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<SheetRawData> {
    const tabName = this.configService.get<string>('OPS_SHEET_TAB_NAME')!;
    const auth = this.getAuth(accessToken);
    const sheets = google.sheets({ version: 'v4', auth });

    // Step 1: Get metadata to find tab dimensions
    const metaResponse = await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        'sheets(properties(title,sheetId,gridProperties(rowCount,columnCount)))',
    });

    const sheetMeta = metaResponse.data.sheets?.find(
      (s) => s.properties?.title === tabName,
    );
    if (!sheetMeta) {
      throw new Error(`Tab "${tabName}" not found in spreadsheet`);
    }

    const rowCount = sheetMeta.properties!.gridProperties!.rowCount!;
    const columnCount = sheetMeta.properties!.gridProperties!.columnCount!;
    const lastColLetter = columnIndexToLetter(columnCount);

    // Step 2: batchGet static columns (A-E) and weekly columns (F onward)
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: [
        `'${tabName}'!A1:E${rowCount}`,
        `'${tabName}'!F1:${lastColLetter}${rowCount}`,
      ],
    });

    const staticRange = (batchResponse.data.valueRanges?.[0]?.values ??
      []) as string[][];
    const weeklyRange = (batchResponse.data.valueRanges?.[1]?.values ??
      []) as string[][];

    // Row 1 is headers
    const headers = staticRange[0] ?? [];
    const staticData = staticRange.slice(1);
    const weeklyData = weeklyRange;

    this.logger.log(
      `Read sheet: ${staticData.length} data rows, ${columnCount} columns`,
    );

    return { headers, staticData, weeklyData, columnCount };
  }
}
