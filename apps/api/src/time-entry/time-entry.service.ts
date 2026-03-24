import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { format } from 'date-fns';
import { SheetsService } from '../sheets/sheets.service.js';
import { UserService } from '../user/user.service.js';
import {
  getWeekRangeForOffset,
  isWithinCurrentWeek,
  parseDDMMYYYY,
} from '../common/utils/date.utils.js';
import { isWithinInterval } from 'date-fns';
import {
  SHEET_SYNC_QUEUE,
  SheetSyncJobPayload,
} from '../queue/sheet-sync.types.js';
import { CacheService } from '../cache/cache.service.js';
import { CreateTimeEntryDto, UpdateTimeEntryDto } from './time-entry.dto.js';
import { TimeEntry, WeekEntriesResponse } from './time-entry.types.js';

@Injectable()
export class TimeEntryService {
  private readonly logger = new Logger(TimeEntryService.name);

  constructor(
    @InjectQueue(SHEET_SYNC_QUEUE)
    private readonly sheetSyncQueue: Queue<SheetSyncJobPayload>,
    private readonly sheetsService: SheetsService,
    private readonly userService: UserService,
    private readonly cacheService: CacheService,
  ) {}

  async createEntry(
    userId: string,
    dto: CreateTimeEntryDto,
  ): Promise<{ jobId: string }> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const date = parseDDMMYYYY(dto.date, dto.timezone);
    if (isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date');
    }
    if (!isWithinCurrentWeek(date, dto.timezone)) {
      throw new BadRequestException(
        'Date must be within the current week (Mon-Sun)',
      );
    }

    const payload: SheetSyncJobPayload = {
      type: 'append',
      userId,
      spreadsheetId: user.spreadsheetId,
      row: [
        dto.date,
        dto.project,
        dto.task ?? '',
        dto.hours,
        dto.comments ?? '',
      ],
    };

    const job = await this.sheetSyncQueue.add('append', payload);
    this.logger.log(`Enqueued append job ${job.id} for user ${userId}`);
    return { jobId: `${SHEET_SYNC_QUEUE}:${job.id}` };
  }

  async getWeekEntries(
    userId: string,
    accessToken: string,
    timezone?: string,
    weekOffset = 0,
  ): Promise<WeekEntriesResponse> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const { start, end } = getWeekRangeForOffset(weekOffset, timezone);
    const allRows = await this.sheetsService.getWeekEntries(
      user.spreadsheetId,
      accessToken,
    );

    const entries: TimeEntry[] = allRows
      .filter((row) => {
        if (!row.values[0]) return false;
        const date = parseDDMMYYYY(row.values[0], timezone);
        return !isNaN(date.getTime()) && isWithinInterval(date, { start, end });
      })
      .map((row) => ({
        rowIndex: row.rowIndex,
        date: row.values[0],
        project: row.values[1] ?? '',
        task: row.values[2] ?? '',
        hours: parseFloat(String(row.values[3] ?? '0').replace(',', '.')) || 0,
        comments: row.values[4] ?? '',
      }));

    entries.sort((a, b) => {
      const dateA = parseDDMMYYYY(a.date, timezone).getTime();
      const dateB = parseDDMMYYYY(b.date, timezone).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.rowIndex - a.rowIndex;
    });

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);

    return {
      weekStart: format(start, 'dd/MM/yyyy'),
      weekEnd: format(end, 'dd/MM/yyyy'),
      entries,
      totalHours: Math.round(totalHours * 100) / 100,
    };
  }

  async updateEntry(
    userId: string,
    rowIndex: number,
    dto: UpdateTimeEntryDto,
  ): Promise<{ jobId: string }> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    if (dto.date) {
      const date = parseDDMMYYYY(dto.date, dto.timezone);
      if (isNaN(date.getTime())) {
        throw new BadRequestException('Invalid date');
      }
      if (!isWithinCurrentWeek(date, dto.timezone)) {
        throw new BadRequestException(
          'Date must be within the current week (Mon-Sun)',
        );
      }
    }

    const payload: SheetSyncJobPayload = {
      type: 'update',
      userId,
      spreadsheetId: user.spreadsheetId,
      rowIndex,
      row: [
        dto.date ?? '',
        dto.project ?? '',
        dto.task ?? '',
        dto.hours ?? 0,
        dto.comments ?? '',
      ],
    };

    const job = await this.sheetSyncQueue.add('update', payload);
    this.logger.log(`Enqueued update job ${job.id} for row ${rowIndex}`);
    return { jobId: `${SHEET_SYNC_QUEUE}:${job.id}` };
  }

  async deleteEntry(
    userId: string,
    rowIndex: number,
  ): Promise<{ jobId: string }> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const payload: SheetSyncJobPayload = {
      type: 'clear',
      userId,
      spreadsheetId: user.spreadsheetId,
      rowIndex,
    };

    const job = await this.sheetSyncQueue.add('clear', payload);
    this.logger.log(`Enqueued clear job ${job.id} for row ${rowIndex}`);
    return { jobId: `${SHEET_SYNC_QUEUE}:${job.id}` };
  }

  private static readonly RECENT_TASKS_TTL = 300; // 5 minutes
  private static readonly RECENT_TASKS_LIMIT = 10;

  async getRecentTasks(
    userId: string,
    accessToken: string,
    project?: string,
  ): Promise<{ tasks: string[] }> {
    const normalizedProject = project?.toLowerCase();
    const cacheKey = normalizedProject
      ? `recent-tasks:${userId}:${normalizedProject}`
      : `recent-tasks:${userId}`;
    const cached = await this.cacheService.get<{ tasks: string[] }>(cacheKey);
    if (cached) return cached;

    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const allRows = await this.sheetsService.getWeekEntries(
      user.spreadsheetId,
      accessToken,
    );

    // Parse rows and sort by date DESC, rowIndex DESC (skip header row)
    const rowsWithTasks = allRows
      .filter(
        (row) =>
          row.rowIndex > 1 &&
          (row.values[2] ?? '').trim() !== '' &&
          (!project ||
            (row.values[1] ?? '').toLowerCase() === project.toLowerCase()),
      )
      .map((row) => ({
        rowIndex: row.rowIndex,
        date: row.values[0] ?? '',
        task: (row.values[2] ?? '').trim(),
      }));

    rowsWithTasks.sort((a, b) => {
      const dateA = parseDDMMYYYY(a.date).getTime();
      const dateB = parseDDMMYYYY(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.rowIndex - a.rowIndex;
    });

    // Deduplicate keeping first (most recent) occurrence
    const seen = new Set<string>();
    const tasks: string[] = [];
    for (const row of rowsWithTasks) {
      const key = row.task.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push(row.task);
        if (tasks.length >= TimeEntryService.RECENT_TASKS_LIMIT) break;
      }
    }

    const result = { tasks };
    await this.cacheService.set(
      cacheKey,
      result,
      TimeEntryService.RECENT_TASKS_TTL,
    );
    return result;
  }

  async getJobStatus(userId: string, jobId: string) {
    const id = jobId.startsWith(`${SHEET_SYNC_QUEUE}:`)
      ? jobId.slice(SHEET_SYNC_QUEUE.length + 1)
      : jobId;
    const job = await this.sheetSyncQueue.getJob(id);
    if (!job || job.data.userId !== userId) {
      return { jobId, status: 'not_found' };
    }
    const state = await job.getState();
    return { jobId, status: state };
  }
}
