import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { SheetsService } from '../sheets/sheets.service.js';
import { UserService } from '../user/user.service.js';
import { decrypt } from '../common/utils/encryption.utils.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { InvalidRefreshTokenError } from '../common/errors/invalid-refresh-token.error.js';
import {
  isWithinCurrentWeek,
  parseDDMMYYYY,
} from '../common/utils/date.utils.js';
import { CacheService } from '../cache/cache.service.js';
import { SHEET_SYNC_QUEUE, SheetSyncJobPayload } from './sheet-sync.types.js';

@Processor(SHEET_SYNC_QUEUE)
export class SheetSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SheetSyncProcessor.name);

  constructor(
    private readonly sheetsService: SheetsService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
    private readonly cacheService: CacheService,
  ) {
    super();
  }

  async process(job: Job<SheetSyncJobPayload>): Promise<void> {
    const { type, userId, spreadsheetId, rowIndex, row } = job.data;
    this.logger.log(`Processing ${type} job ${job.id} for user ${userId}`);

    const user = await this.userService.findByGoogleId(userId);
    if (!user?.encryptedRefreshToken) {
      throw new Error(`User ${userId} not found or missing refresh token`);
    }

    let accessToken: string;
    try {
      const encryptionKey = this.configService.get<string>(
        'TOKEN_ENCRYPTION_KEY',
      )!;
      const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      )!;
      ({ accessToken } = await exchangeRefreshToken(
        refreshToken,
        clientId,
        clientSecret,
      ));
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        this.logger.warn(
          `Refresh token invalid for user ${userId}, clearing stored token`,
        );
        await this.userService.createOrUpdate({
          googleId: userId,
          encryptedRefreshToken: null,
        });
        throw new Error(
          `Refresh token revoked for user ${userId}. Re-authentication required.`,
        );
      }
      throw error;
    }

    switch (type) {
      case 'append': {
        if (!row) throw new Error('Row data required for append');
        const appendedRow = await this.sheetsService.appendRow(
          spreadsheetId,
          accessToken,
          row,
        );
        this.logger.log(`Completed append job ${job.id} — row ${appendedRow}`);
        break;
      }
      case 'update': {
        if (!rowIndex || !row)
          throw new Error('Row index and data required for update');
        const existingRow = await this.sheetsService.getRow(
          spreadsheetId,
          accessToken,
          rowIndex,
        );
        if (existingRow.length === 0) {
          throw new Error(`Row ${rowIndex} does not exist in the sheet`);
        }
        const existingDate = parseDDMMYYYY(existingRow[0]);
        if (
          isNaN(existingDate.getTime()) ||
          !isWithinCurrentWeek(existingDate)
        ) {
          throw new Error(
            `Row ${rowIndex} has date "${existingRow[0]}" which is not in the current week. Update rejected.`,
          );
        }
        await this.sheetsService.updateRow(
          spreadsheetId,
          accessToken,
          rowIndex,
          row,
        );
        break;
      }
      case 'clear': {
        if (!rowIndex) throw new Error('Row index required for clear');
        const existingRow = await this.sheetsService.getRow(
          spreadsheetId,
          accessToken,
          rowIndex,
        );
        if (existingRow.length === 0) {
          throw new Error(`Row ${rowIndex} does not exist in the sheet`);
        }
        const existingDate = parseDDMMYYYY(existingRow[0]);
        if (
          isNaN(existingDate.getTime()) ||
          !isWithinCurrentWeek(existingDate)
        ) {
          throw new Error(
            `Row ${rowIndex} has date "${existingRow[0]}" which is not in the current week. Delete rejected.`,
          );
        }
        await this.sheetsService.clearRow(spreadsheetId, accessToken, rowIndex);
        break;
      }
    }

    await this.cacheService.del(`recent-tasks:${userId}`);
    this.logger.log(`Completed ${type} job ${job.id}`);
  }
}
