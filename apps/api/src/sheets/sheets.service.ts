import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';

@Injectable()
export class SheetsService {
  private readonly logger = new Logger(SheetsService.name);

  private getAuth(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    return auth;
  }

  async appendRow(
    spreadsheetId: string,
    accessToken: string,
    row: (string | number)[],
  ): Promise<number> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'TimeSheet!A:E',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });

    const updatedRange = response.data.updates?.updatedRange ?? '';
    const rowMatch = updatedRange.match(/(\d+)$/);
    const rowNumber = rowMatch ? parseInt(rowMatch[1], 10) : -1;

    this.logger.log(
      `Appended row at line ${rowNumber} in sheet ${spreadsheetId}`,
    );
    return rowNumber;
  }

  async updateRow(
    spreadsheetId: string,
    accessToken: string,
    rowIndex: number,
    row: (string | number)[],
  ): Promise<void> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `TimeSheet!A${rowIndex}:E${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [row] },
    });
    this.logger.log(`Updated row ${rowIndex} in sheet ${spreadsheetId}`);
  }

  async getRow(
    spreadsheetId: string,
    accessToken: string,
    rowIndex: number,
  ): Promise<string[]> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `TimeSheet!A${rowIndex}:E${rowIndex}`,
    });
    const rows = (response.data.values ?? []) as string[][];
    return rows[0] ?? [];
  }

  async clearRow(
    spreadsheetId: string,
    accessToken: string,
    rowIndex: number,
  ): Promise<void> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `TimeSheet!A${rowIndex}:E${rowIndex}`,
    });
    this.logger.log(`Cleared row ${rowIndex} in sheet ${spreadsheetId}`);
  }

  async getWeekEntries(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<{ rowIndex: number; values: string[] }[]> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'TimeSheet!A:E',
    });

    const rows = response.data.values ?? [];
    return rows
      .map((values, index) => ({ rowIndex: index + 1, values }))
      .filter((row) => row.values.length > 0);
  }

  async validateSpreadsheet(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<{
    valid: boolean;
    error?: 'not_found' | 'access_denied' | 'not_google_sheet';
  }> {
    try {
      const sheets = google.sheets({
        version: 'v4',
        auth: this.getAuth(accessToken),
      });
      await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId',
      });
      return { valid: true };
    } catch (error: unknown) {
      const gError = error as {
        response?: { status?: number };
        code?: number;
        cause?: { errors?: Array<{ reason?: string }> };
      };
      const status = gError.response?.status ?? gError.code;
      const reason = gError.cause?.errors?.[0]?.reason;
      if (status === 400 && reason === 'failedPrecondition') {
        return { valid: false, error: 'not_google_sheet' };
      }
      if (status === 403) {
        return { valid: false, error: 'access_denied' };
      }
      if (status === 404) {
        return { valid: false, error: 'not_found' };
      }
      throw error;
    }
  }

  async getProjectsFromPlanning(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<string[]> {
    try {
      const sheets = google.sheets({
        version: 'v4',
        auth: this.getAuth(accessToken),
      });
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: 'Planning!C8:C',
      });

      const rows = response.data.values ?? [];
      const seen = new Set<string>();
      const projects: string[] = [];
      for (const cell of rows.flat()) {
        const raw = typeof cell === 'string' ? cell : '';
        if (!raw.trim() || seen.has(raw)) continue;
        seen.add(raw);
        projects.push(raw);
      }
      return projects;
    } catch (error: unknown) {
      const gError = error as { response?: { status?: number }; code?: number };
      const status = gError.response?.status ?? gError.code;
      if (status === 400 || status === 404) {
        this.logger.warn(`Planning tab not found in sheet ${spreadsheetId}`);
        return [];
      }
      throw error;
    }
  }

  async getDataValidation(
    spreadsheetId: string,
    accessToken: string,
  ): Promise<string[]> {
    const sheets = google.sheets({
      version: 'v4',
      auth: this.getAuth(accessToken),
    });
    const response = await sheets.spreadsheets.get({
      spreadsheetId,
      fields: 'sheets.data.rowData.values.dataValidation',
      ranges: ['B:B'],
    });

    const rowData = response.data.sheets?.[0]?.data?.[0]?.rowData ?? [];

    for (const row of rowData) {
      const validation = row.values?.[0]?.dataValidation;
      if (!validation?.condition?.values) continue;

      const conditionType = validation.condition.type;

      if (conditionType === 'ONE_OF_RANGE') {
        // Validation references a range (e.g. "=Planning!C8:C") — read actual values
        const rangeRef = validation.condition.values[0]?.userEnteredValue;
        if (!rangeRef) continue;
        // Strip leading '=' if present
        const range = rangeRef.startsWith('=') ? rangeRef.slice(1) : rangeRef;
        const rangeResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range,
        });
        const rangeRows = rangeResponse.data.values ?? [];
        const seen = new Set<string>();
        const projects: string[] = [];
        for (const cell of rangeRows.flat()) {
          const raw = typeof cell === 'string' ? cell : '';
          if (!raw.trim() || seen.has(raw)) continue;
          seen.add(raw);
          projects.push(raw);
        }
        return projects;
      }

      // ONE_OF_LIST or other: return values as-is
      return validation.condition.values
        .map((v) => v.userEnteredValue ?? '')
        .filter(Boolean);
    }

    return [];
  }
}
