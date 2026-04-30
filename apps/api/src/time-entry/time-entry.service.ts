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
import {
  TimeEntry,
  WeekEntriesResponse,
  TaskSummaryEntry,
  TaskSummaryResponse,
  ProjectUsageEntry,
  ProjectUsageResponse,
} from './time-entry.types.js';

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
  private static readonly PROJECT_USAGE_TTL = 300; // 5 minutes

  async getRecentTasks(
    userId: string,
    accessToken: string,
    project?: string,
  ): Promise<{ tasks: { task: string; project: string }[] }> {
    const normalizedProject = project?.toLowerCase();
    const cacheKey = normalizedProject
      ? `recent-tasks:${userId}:${normalizedProject}`
      : `recent-tasks:${userId}`;
    const cached = await this.cacheService.get<{
      tasks: { task: string; project: string }[];
    }>(cacheKey);
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
        project: (row.values[1] ?? '').trim(),
      }));

    rowsWithTasks.sort((a, b) => {
      const dateA = parseDDMMYYYY(a.date).getTime();
      const dateB = parseDDMMYYYY(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.rowIndex - a.rowIndex;
    });

    // Deduplicate keeping first (most recent) occurrence
    const seen = new Set<string>();
    const tasks: { task: string; project: string }[] = [];
    for (const row of rowsWithTasks) {
      const key = row.task.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        tasks.push({ task: row.task, project: row.project });
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

  private static readonly TASK_SUMMARY_ENTRIES_LIMIT = 20;

  async getTaskSummary(
    userId: string,
    accessToken: string,
    task: string,
  ): Promise<TaskSummaryResponse> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const allRows = await this.sheetsService.getWeekEntries(
      user.spreadsheetId,
      accessToken,
    );

    const normalizedTask = task.toLowerCase();

    const matchingRows = allRows
      .filter(
        (row) =>
          row.rowIndex > 1 &&
          (row.values[2] ?? '').trim().toLowerCase() === normalizedTask,
      )
      .map((row) => ({
        rowIndex: row.rowIndex,
        date: row.values[0] ?? '',
        project: (row.values[1] ?? '').trim(),
        hours: parseFloat(String(row.values[3] ?? '0').replace(',', '.')) || 0,
        comments: (row.values[4] ?? '').trim(),
      }));

    if (matchingRows.length === 0) {
      return {
        task,
        totalHours: 0,
        entryCount: 0,
        earliestDate: '',
        latestDate: '',
        averageHoursPerEntry: 0,
        entries: [],
      };
    }

    const totalHours = matchingRows.reduce((sum, r) => sum + r.hours, 0);
    const entryCount = matchingRows.length;
    const averageHoursPerEntry =
      Math.round((totalHours / entryCount) * 100) / 100;

    // Sort by date DESC, rowIndex DESC for recency
    matchingRows.sort((a, b) => {
      const dateA = parseDDMMYYYY(a.date).getTime();
      const dateB = parseDDMMYYYY(b.date).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return b.rowIndex - a.rowIndex;
    });

    const latestDate = matchingRows[0].date;
    const earliestDate = matchingRows[matchingRows.length - 1].date;

    const entries: TaskSummaryEntry[] = matchingRows
      .slice(0, TimeEntryService.TASK_SUMMARY_ENTRIES_LIMIT)
      .map((r) => ({
        date: r.date,
        project: r.project,
        hours: r.hours,
        comments: r.comments,
      }));

    return {
      task,
      totalHours: Math.round(totalHours * 100) / 100,
      entryCount,
      earliestDate,
      latestDate,
      averageHoursPerEntry,
      entries,
    };
  }

  async getProjectUsage(
    userId: string,
    accessToken: string,
  ): Promise<ProjectUsageResponse> {
    const cacheKey = `project-usage:${userId}`;
    const cached = await this.cacheService.get<ProjectUsageResponse>(cacheKey);
    if (cached) return cached;

    const user = await this.userService.findByGoogleId(userId);
    if (!user?.spreadsheetId) {
      throw new BadRequestException('No spreadsheet configured');
    }

    const allRows = await this.sheetsService.getWeekEntries(
      user.spreadsheetId,
      accessToken,
    );

    type Bucket = {
      project: string;
      count: number;
      latestDate: string;
      latestTime: number;
      latestRowIndex: number;
    };
    const byKey = new Map<string, Bucket>();

    for (const row of allRows) {
      if (row.rowIndex <= 1) continue;
      const project = (row.values[1] ?? '').trim();
      if (!project) continue;
      const date = row.values[0] ?? '';
      const time = parseDDMMYYYY(date).getTime();
      const key = project.toLowerCase();
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, {
          project,
          count: 1,
          latestDate: date,
          latestTime: isNaN(time) ? 0 : time,
          latestRowIndex: row.rowIndex,
        });
      } else {
        existing.count += 1;
        const t = isNaN(time) ? 0 : time;
        if (
          t > existing.latestTime ||
          (t === existing.latestTime && row.rowIndex > existing.latestRowIndex)
        ) {
          existing.latestTime = t;
          existing.latestDate = date;
          existing.latestRowIndex = row.rowIndex;
          existing.project = project;
        }
      }
    }

    const usage: ProjectUsageEntry[] = Array.from(byKey.values())
      .map((b) => ({
        project: b.project,
        count: b.count,
        lastUsedDate: b.latestDate,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.project.localeCompare(b.project);
      });

    const result: ProjectUsageResponse = { usage };
    await this.cacheService.set(
      cacheKey,
      result,
      TimeEntryService.PROJECT_USAGE_TTL,
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
