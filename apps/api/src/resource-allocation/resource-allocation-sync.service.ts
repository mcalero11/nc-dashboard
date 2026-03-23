import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  parse,
  startOfWeek,
  addWeeks,
  subWeeks,
  format,
  isAfter,
  isBefore,
} from 'date-fns';
import { randomUUID } from 'crypto';
import { OpsSyncConfig } from './entities/ops-sync-config.entity.js';
import { OpsProject } from './entities/ops-project.entity.js';
import { OpsAllocation } from './entities/ops-allocation.entity.js';
import { ResourceAllocationSheetsService } from './resource-allocation-sheets.service.js';
import { UserService } from '../user/user.service.js';
import { decrypt } from '../common/utils/encryption.utils.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { InvalidRefreshTokenError } from '../common/errors/invalid-refresh-token.error.js';
import type { OpsAccessStatusResponse } from '@nc-dashboard/shared';

const SINGLETON_ID = 'singleton';

function parseWeekHeader(
  header: string,
  inferredYear: number,
): { parsedDate: Date | null; consumedExplicitYear: boolean } {
  const withExplicitYear = parse(
    header,
    'd-MMM-yyyy',
    new Date(inferredYear, 0, 1),
  );
  if (!isNaN(withExplicitYear.getTime())) {
    return { parsedDate: withExplicitYear, consumedExplicitYear: true };
  }

  const inferredYearDate = parse(header, 'd-MMM', new Date(inferredYear, 0, 1));
  if (!isNaN(inferredYearDate.getTime())) {
    return { parsedDate: inferredYearDate, consumedExplicitYear: false };
  }

  return { parsedDate: null, consumedExplicitYear: false };
}

export class NoOpsUsersAvailableError extends Error {
  constructor() {
    super(
      'No valid access token available. All users with OPS sheet access have invalid or missing tokens.',
    );
    this.name = 'NoOpsUsersAvailableError';
  }
}

@Injectable()
export class ResourceAllocationSyncService {
  private readonly logger = new Logger(ResourceAllocationSyncService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OpsSyncConfig)
    private readonly syncConfigRepo: Repository<OpsSyncConfig>,
    @InjectRepository(OpsProject)
    private readonly projectRepo: Repository<OpsProject>,
    @InjectRepository(OpsAllocation)
    private readonly allocationRepo: Repository<OpsAllocation>,
    private readonly userService: UserService,
    private readonly sheetsService: ResourceAllocationSheetsService,
    private readonly configService: ConfigService,
  ) {}

  async getOrCreateConfig(): Promise<OpsSyncConfig> {
    let config = await this.syncConfigRepo.findOneBy({ id: SINGLETON_ID });
    if (!config) {
      config = this.syncConfigRepo.create({
        id: SINGLETON_ID,
        spreadsheetId: null,
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        lastSyncUserId: null,
        updatedAt: null,
      });
      await this.syncConfigRepo.save(config);
    }
    return config;
  }

  async acquireAccessToken(
    preferredUserId?: string,
  ): Promise<{ accessToken: string; userId: string }> {
    const encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
    )!;
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
    const clientSecret = this.configService.get<string>(
      'GOOGLE_CLIENT_SECRET',
    )!;

    const users = await this.userService.findUsersWithOpsAccess();

    // Try preferred user first
    if (preferredUserId) {
      const preferred = users.find((u) => u.googleId === preferredUserId);
      if (preferred) {
        // Move to front
        const idx = users.indexOf(preferred);
        users.splice(idx, 1);
        users.unshift(preferred);
      }
    }

    for (const user of users) {
      if (!user.encryptedRefreshToken) continue;
      try {
        const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
        const { accessToken } = await exchangeRefreshToken(
          refreshToken,
          clientId,
          clientSecret,
        );
        return { accessToken, userId: user.googleId };
      } catch (error) {
        if (error instanceof InvalidRefreshTokenError) {
          this.logger.warn(
            `Refresh token invalid for user ${user.googleId}, clearing token`,
          );
          await this.userService.createOrUpdate({
            googleId: user.googleId,
            encryptedRefreshToken: null,
          });
          continue;
        }
        throw error;
      }
    }

    throw new NoOpsUsersAvailableError();
  }

  async syncFromSheet(
    triggeredBy: 'schedule' | 'manual',
    preferredUserId?: string,
  ): Promise<void> {
    const config = await this.getOrCreateConfig();

    try {
      // Acquire token
      const { accessToken, userId } =
        await this.acquireAccessToken(preferredUserId);

      // Resolve spreadsheet ID
      let spreadsheetId = config.spreadsheetId;
      if (!spreadsheetId) {
        const discovered =
          await this.sheetsService.discoverOpsSheet(accessToken);
        if (!discovered) {
          throw new Error('OPS sheet not found via Drive API discovery');
        }
        spreadsheetId = discovered.spreadsheetId;
        config.spreadsheetId = spreadsheetId;
      }

      // Read sheet data
      const rawData = await this.sheetsService.readSheetData(
        spreadsheetId,
        accessToken,
      );

      // Parse
      const weeksAhead =
        this.configService.get<number>('OPS_SYNC_WEEKS_AHEAD') ?? 12;
      const weeksBehind =
        this.configService.get<number>('OPS_SYNC_WEEKS_BEHIND') ?? 0;
      const { projects, allocations } = this.parseSheetData(
        rawData.headers,
        rawData.staticData,
        rawData.weeklyData,
        weeksBehind,
        weeksAhead,
      );

      // Atomic replace
      await this.atomicReplace(projects, allocations);

      // Update config
      const now = new Date().toISOString();
      config.lastSyncAt = now;
      config.lastSyncStatus = 'success';
      config.lastSyncError = null;
      config.lastSyncUserId = userId;
      config.updatedAt = now;
      await this.syncConfigRepo.save(config);

      this.logger.log(
        `Sync complete (${triggeredBy}): ${projects.length} projects, ${allocations.length} allocations`,
      );
    } catch (error: unknown) {
      const now = new Date().toISOString();
      config.lastSyncStatus = 'failed';
      config.lastSyncError =
        error instanceof Error ? error.message : String(error);
      config.updatedAt = now;
      await this.syncConfigRepo.save(config);
      throw error;
    }
  }

  parseSheetData(
    _headers: string[],
    staticData: string[][],
    weeklyData: string[][],
    weeksBehind: number,
    weeksAhead: number,
  ): { projects: OpsProject[]; allocations: OpsAllocation[] } {
    const syncBatchId = randomUUID();
    const projects: OpsProject[] = [];
    const allocations: OpsAllocation[] = [];

    // Parse date headers from row 1 of weeklyData (index 0)
    const dateHeaders = weeklyData[0] ?? [];
    const now = new Date();
    const currentMonday = startOfWeek(now, { weekStartsOn: 1 });
    const windowStart = subWeeks(currentMonday, weeksBehind);
    const windowEnd = addWeeks(currentMonday, weeksAhead);

    // Parse date columns with year inference
    const weekColumns: { colIndex: number; date: Date; isoDate: string }[] = [];
    let inferredYear = currentMonday.getFullYear();
    let prevMonth = -1;

    for (let i = 0; i < dateHeaders.length; i++) {
      const header = (dateHeaders[i] ?? '').toString().trim();
      if (!header) continue;

      const { parsedDate, consumedExplicitYear } = parseWeekHeader(
        header,
        inferredYear,
      );
      if (!parsedDate) continue;

      // Year boundary detection: if month decreases, increment year
      const parsedMonth = parsedDate.getMonth();
      if (
        !consumedExplicitYear &&
        prevMonth !== -1 &&
        parsedMonth < prevMonth
      ) {
        inferredYear++;
        parsedDate.setFullYear(inferredYear);
      }
      prevMonth = parsedMonth;
      if (!consumedExplicitYear) {
        parsedDate.setFullYear(inferredYear);
      }

      // Filter to window [currentMonday - weeksBehind, currentMonday + weeksAhead]
      if (
        !isBefore(parsedDate, windowStart) &&
        !isAfter(parsedDate, windowEnd)
      ) {
        const isoDate = format(parsedDate, 'yyyy-MM-dd');
        weekColumns.push({ colIndex: i, date: parsedDate, isoDate });
      }
    }

    // Parse data rows (weeklyData rows start at index 1 = row 2 of sheet)
    for (let rowIdx = 0; rowIdx < staticData.length; rowIdx++) {
      const row = staticData[rowIdx] ?? [];
      const projectName = (row[0] ?? '').toString().trim();
      const role = (row[1] ?? '').toString().trim();
      const metadata = (row[2] ?? '').toString().trim();
      const colD = (row[3] ?? '').toString().trim();
      const comments = (row[4] ?? '').toString().trim();

      if (role === 'TOTAL') {
        // Project header row
        const project = new OpsProject();
        project.projectName = projectName;
        project.engagementType = colD;
        project.metadata = metadata;
        project.isInternal = projectName.startsWith('z');
        project.sheetRowIndex = rowIdx + 2; // 1-based, row 1 is header
        project.syncBatchId = syncBatchId;
        projects.push(project);
      } else if (projectName) {
        // Member allocation row
        const weeklyDataRow = weeklyData[rowIdx + 1] ?? []; // +1 because weeklyData[0] is headers
        const weeklyHours: Record<string, number> = {};

        for (const wc of weekColumns) {
          const cellValue = (weeklyDataRow[wc.colIndex] ?? '')
            .toString()
            .trim();
          const hours = parseFloat(cellValue);
          if (!isNaN(hours) && hours > 0) {
            weeklyHours[wc.isoDate] = hours;
          }
        }

        const allocation = new OpsAllocation();
        allocation.projectName = projectName;
        allocation.role = role;
        allocation.personName = colD;
        allocation.comments = comments;
        allocation.isUnassigned = colD === 'A Definir';
        allocation.weeklyHours = JSON.stringify(weeklyHours);
        allocation.sheetRowIndex = rowIdx + 2;
        allocation.syncBatchId = syncBatchId;
        allocations.push(allocation);
      }
      // else: empty/skip row
    }

    return { projects, allocations };
  }

  private async atomicReplace(
    projects: OpsProject[],
    allocations: OpsAllocation[],
  ): Promise<void> {
    if (projects.length === 0 || allocations.length === 0) {
      throw new Error(
        `Refusing to sync empty data: ${projects.length} projects, ${allocations.length} allocations. ` +
          'This may indicate a problem reading the source sheet.',
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.clear(OpsAllocation);
      await queryRunner.manager.clear(OpsProject);
      await queryRunner.manager.save(OpsProject, projects);
      await queryRunner.manager.save(OpsAllocation, allocations);
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async checkUserAccess(userId: string): Promise<OpsAccessStatusResponse> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.encryptedRefreshToken) {
      await this.userService.updateOpsSheetAccess(userId, 'no_access');
      return { access: 'no_access', error: 'token_error' };
    }

    try {
      const encryptionKey = this.configService.get<string>(
        'TOKEN_ENCRYPTION_KEY',
      )!;
      const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
      const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID')!;
      const clientSecret = this.configService.get<string>(
        'GOOGLE_CLIENT_SECRET',
      )!;
      const { accessToken } = await exchangeRefreshToken(
        refreshToken,
        clientId,
        clientSecret,
      );

      // Get or discover spreadsheet ID
      const config = await this.getOrCreateConfig();
      let spreadsheetId = config.spreadsheetId;
      if (!spreadsheetId) {
        const discovered =
          await this.sheetsService.discoverOpsSheet(accessToken);
        if (!discovered) {
          await this.userService.updateOpsSheetAccess(userId, 'no_access');
          return { access: 'no_access' };
        }
        spreadsheetId = discovered.spreadsheetId;
        config.spreadsheetId = spreadsheetId;
        config.updatedAt = new Date().toISOString();
        await this.syncConfigRepo.save(config);
      }

      const hasAccess = await this.sheetsService.checkAccess(
        spreadsheetId,
        accessToken,
      );
      const status = hasAccess ? 'has_access' : 'no_access';
      await this.userService.updateOpsSheetAccess(userId, status);
      return { access: status };
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        await this.userService.updateOpsSheetAccess(userId, 'no_access');
        return { access: 'no_access', error: 'token_error' };
      }
      await this.userService.updateOpsSheetAccess(userId, 'no_access');
      return { access: 'no_access', error: 'unknown' };
    }
  }
}
