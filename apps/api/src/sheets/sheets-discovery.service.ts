import { Injectable, Logger } from '@nestjs/common';
import { google } from 'googleapis';
import { SheetDiscoveryResult } from './sheets.types.js';

@Injectable()
export class SheetsDiscoveryService {
  private readonly logger = new Logger(SheetsDiscoveryService.name);

  async discoverSheet(
    firstName: string,
    lastName: string,
    accessToken: string,
  ): Promise<SheetDiscoveryResult[]> {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const drive = google.drive({ version: 'v3', auth });
    const sheetName = `TimeSheet - ${firstName} ${lastName}`;

    const response = await drive.files.list({
      q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: 'files(id, name, modifiedTime, ownedByMe)',
    });

    const files = response.data.files ?? [];
    this.logger.log(
      `Discovered ${files.length} sheet(s) for ${firstName} ${lastName}`,
    );

    return files.map((file) => ({
      spreadsheetId: file.id!,
      name: file.name!,
      modifiedTime: file.modifiedTime!,
      ownedByMe: file.ownedByMe ?? false,
    }));
  }
}
