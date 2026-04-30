import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { BadRequestException } from '@nestjs/common';
import { TimeEntryService } from './time-entry.service.js';
import { SHEET_SYNC_QUEUE } from '../queue/sheet-sync.types.js';
import { SheetsService } from '../sheets/sheets.service.js';
import { UserService } from '../user/user.service.js';
import { CacheService } from '../cache/cache.service.js';
import { User } from '../user/user.entity.js';

function makeUser(overrides: Partial<User> = {}): User {
  return {
    googleId: 'google-123',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    spreadsheetId: 'sheet-1',
    encryptedRefreshToken: 'enc-token',
    opsSheetAccess: 'unchecked',
    opsPersonAliases: [],
    userType: 'internal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('TimeEntryService', () => {
  let service: TimeEntryService;

  const queueAddMock = jest.fn();
  const queueGetJobMock = jest.fn();
  const getWeekEntriesMock = jest.fn();
  const findByGoogleIdMock = jest.fn();
  const cacheGetMock = jest.fn();
  const cacheSetMock = jest.fn();
  const cacheDelMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntryService,
        {
          provide: getQueueToken(SHEET_SYNC_QUEUE),
          useValue: { add: queueAddMock, getJob: queueGetJobMock },
        },
        {
          provide: SheetsService,
          useValue: { getWeekEntries: getWeekEntriesMock },
        },
        {
          provide: UserService,
          useValue: { findByGoogleId: findByGoogleIdMock },
        },
        {
          provide: CacheService,
          useValue: {
            get: cacheGetMock,
            set: cacheSetMock,
            del: cacheDelMock,
          },
        },
      ],
    }).compile();

    service = module.get(TimeEntryService);
  });

  describe('getJobStatus', () => {
    it('returns the job state when the job belongs to the requesting user', async () => {
      queueGetJobMock.mockResolvedValue({
        data: { userId: 'google-123' },
        getState: jest.fn().mockResolvedValue('completed'),
      });

      await expect(
        service.getJobStatus('google-123', 'sheet-sync:job-1'),
      ).resolves.toEqual({
        jobId: 'sheet-sync:job-1',
        status: 'completed',
      });
    });

    it('hides jobs owned by another user', async () => {
      queueGetJobMock.mockResolvedValue({
        data: { userId: 'other-user' },
        getState: jest.fn(),
      });

      await expect(
        service.getJobStatus('google-123', 'sheet-sync:job-2'),
      ).resolves.toEqual({
        jobId: 'sheet-sync:job-2',
        status: 'not_found',
      });
    });
  });

  describe('getRecentTasks', () => {
    const userId = 'google-123';
    const accessToken = 'test-token';

    function makeRow(
      rowIndex: number,
      date: string,
      task: string,
      project = 'ProjectA',
    ): { rowIndex: number; values: string[] } {
      return {
        rowIndex,
        values: [date, project, task, '1', ''],
      };
    }

    it('returns cached data when available', async () => {
      const cached = {
        tasks: [
          { task: 'HPH-01', project: 'ProjectA' },
          { task: 'HPH-02', project: 'ProjectA' },
        ],
      };
      cacheGetMock.mockResolvedValue(cached);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result).toEqual(cached);
      expect(getWeekEntriesMock).not.toHaveBeenCalled();
    });

    it('fetches from sheets on cache miss and caches the result', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'HPH-01'),
        makeRow(3, '21/03/2026', 'HPH-02'),
      ]);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result.tasks).toEqual([
        { task: 'HPH-02', project: 'ProjectA' },
        { task: 'HPH-01', project: 'ProjectA' },
      ]);
      expect(cacheSetMock).toHaveBeenCalledWith(
        `recent-tasks:${userId}`,
        {
          tasks: [
            { task: 'HPH-02', project: 'ProjectA' },
            { task: 'HPH-01', project: 'ProjectA' },
          ],
        },
        300,
      );
    });

    it('deduplicates tasks case-insensitively keeping the most recent', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(1, '19/03/2026', 'hph-01'),
        makeRow(2, '20/03/2026', 'HPH-01'),
        makeRow(3, '21/03/2026', 'HPH-02'),
      ]);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result.tasks).toEqual([
        { task: 'HPH-02', project: 'ProjectA' },
        { task: 'HPH-01', project: 'ProjectA' },
      ]);
    });

    it('filters out rows with empty tasks', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(1, '20/03/2026', ''),
        makeRow(2, '20/03/2026', '  '),
        makeRow(3, '20/03/2026', 'HPH-01'),
      ]);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result.tasks).toEqual([{ task: 'HPH-01', project: 'ProjectA' }]);
    });

    it('limits to 10 tasks', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());

      const rows = Array.from({ length: 15 }, (_, i) =>
        makeRow(i + 1, '20/03/2026', `TASK-${String(i + 1).padStart(2, '0')}`),
      );
      getWeekEntriesMock.mockResolvedValue(rows);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result.tasks).toHaveLength(10);
    });

    it('sorts by date DESC then rowIndex DESC', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '19/03/2026', 'OLD'),
        makeRow(3, '21/03/2026', 'NEWER-FIRST'),
        makeRow(4, '21/03/2026', 'NEWER-SECOND'),
      ]);

      const result = await service.getRecentTasks(userId, accessToken);

      expect(result.tasks).toEqual([
        { task: 'NEWER-SECOND', project: 'ProjectA' },
        { task: 'NEWER-FIRST', project: 'ProjectA' },
        { task: 'OLD', project: 'ProjectA' },
      ]);
    });

    it('throws when user has no spreadsheet configured', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser({ spreadsheetId: null }));

      await expect(service.getRecentTasks(userId, accessToken)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('filters tasks by project when project parameter is provided', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'TASK-A', 'ProjectA'),
        makeRow(3, '20/03/2026', 'TASK-B', 'ProjectB'),
        makeRow(4, '21/03/2026', 'TASK-C', 'ProjectA'),
      ]);

      const result = await service.getRecentTasks(
        userId,
        accessToken,
        'ProjectA',
      );

      expect(result.tasks).toEqual([
        { task: 'TASK-C', project: 'ProjectA' },
        { task: 'TASK-A', project: 'ProjectA' },
      ]);
    });

    it('uses project-specific cache key when project is provided', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'TASK-A', 'ProjectA'),
      ]);

      await service.getRecentTasks(userId, accessToken, 'ProjectA');

      expect(cacheSetMock).toHaveBeenCalledWith(
        `recent-tasks:${userId}:projecta`,
        { tasks: [{ task: 'TASK-A', project: 'ProjectA' }] },
        300,
      );
    });

    it('returns empty tasks when no rows match the project filter', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'TASK-A', 'ProjectB'),
      ]);

      const result = await service.getRecentTasks(
        userId,
        accessToken,
        'ProjectA',
      );

      expect(result.tasks).toEqual([] as { task: string; project: string }[]);
    });

    it('matches project case-insensitively', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'TASK-A', 'ProjectA'),
      ]);

      const result = await service.getRecentTasks(
        userId,
        accessToken,
        'projecta',
      );

      expect(result.tasks).toEqual([{ task: 'TASK-A', project: 'ProjectA' }]);
    });
  });

  describe('getTaskSummary', () => {
    const userId = 'google-123';
    const accessToken = 'test-token';

    function makeRow(
      rowIndex: number,
      date: string,
      task: string,
      project = 'ProjectA',
      hours = '1',
      comments = '',
    ): { rowIndex: number; values: string[] } {
      return {
        rowIndex,
        values: [date, project, task, hours, comments],
      };
    }

    it('computes correct summary for multiple entries', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'HPH-01', 'ProjectA', '2'),
        makeRow(3, '21/03/2026', 'HPH-01', 'ProjectA', '3'),
        makeRow(4, '22/03/2026', 'HPH-02', 'ProjectA', '1'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-01',
      );

      expect(result.totalHours).toBe(5);
      expect(result.entryCount).toBe(2);
      expect(result.earliestDate).toBe('20/03/2026');
      expect(result.latestDate).toBe('21/03/2026');
      expect(result.averageHoursPerEntry).toBe(2.5);
      expect(result.entries).toHaveLength(2);
    });

    it('matches task name case-insensitively', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'hph-01', 'ProjectA', '2'),
        makeRow(3, '21/03/2026', 'HPH-01', 'ProjectA', '3'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'Hph-01',
      );

      expect(result.entryCount).toBe(2);
      expect(result.totalHours).toBe(5);
    });

    it('returns empty response when no entries found', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'OTHER-TASK', 'ProjectA', '1'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-99',
      );

      expect(result.task).toBe('HPH-99');
      expect(result.totalHours).toBe(0);
      expect(result.entryCount).toBe(0);
      expect(result.earliestDate).toBe('');
      expect(result.latestDate).toBe('');
      expect(result.averageHoursPerEntry).toBe(0);
      expect(result.entries).toEqual([]);
    });

    it('limits entries to 20 most recent', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());

      const rows = Array.from({ length: 25 }, (_, i) =>
        makeRow(
          i + 2,
          `${String((i % 28) + 1).padStart(2, '0')}/03/2026`,
          'HPH-01',
          'ProjectA',
          '1',
        ),
      );
      getWeekEntriesMock.mockResolvedValue(rows);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-01',
      );

      expect(result.entryCount).toBe(25);
      expect(result.entries).toHaveLength(20);
    });

    it('sorts entries by date descending', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '18/03/2026', 'HPH-01', 'ProjectA', '1'),
        makeRow(3, '22/03/2026', 'HPH-01', 'ProjectA', '2'),
        makeRow(4, '20/03/2026', 'HPH-01', 'ProjectA', '3'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-01',
      );

      expect(result.entries.map((e) => e.date)).toEqual([
        '22/03/2026',
        '20/03/2026',
        '18/03/2026',
      ]);
    });

    it('aggregates across multiple projects', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'HPH-01', 'ProjectA', '2'),
        makeRow(3, '21/03/2026', 'HPH-01', 'ProjectB', '3'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-01',
      );

      expect(result.totalHours).toBe(5);
      expect(result.entryCount).toBe(2);
      expect(result.entries.map((e) => e.project)).toEqual([
        'ProjectB',
        'ProjectA',
      ]);
    });

    it('throws when user has no spreadsheet configured', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser({ spreadsheetId: null }));

      await expect(
        service.getTaskSummary(userId, accessToken, 'HPH-01'),
      ).rejects.toThrow(BadRequestException);
    });

    it('includes comments in entries', async () => {
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'HPH-01', 'ProjectA', '1', 'Fixed bug'),
      ]);

      const result = await service.getTaskSummary(
        userId,
        accessToken,
        'HPH-01',
      );

      expect(result.entries[0].comments).toBe('Fixed bug');
    });
  });

  describe('getProjectUsage', () => {
    const userId = 'google-123';
    const accessToken = 'test-token';

    function makeRow(
      rowIndex: number,
      date: string,
      project: string,
    ): { rowIndex: number; values: string[] } {
      return {
        rowIndex,
        values: [date, project, '', '1', ''],
      };
    }

    it('returns cached data when available', async () => {
      const cached = {
        usage: [{ project: 'ProjectA', count: 3, lastUsedDate: '21/03/2026' }],
      };
      cacheGetMock.mockResolvedValue(cached);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result).toEqual(cached);
      expect(getWeekEntriesMock).not.toHaveBeenCalled();
    });

    it('fetches from sheets on cache miss and caches the result', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'ProjectA'),
        makeRow(3, '21/03/2026', 'ProjectA'),
        makeRow(4, '22/03/2026', 'ProjectB'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage).toEqual([
        { project: 'ProjectA', count: 2, lastUsedDate: '21/03/2026' },
        { project: 'ProjectB', count: 1, lastUsedDate: '22/03/2026' },
      ]);
      expect(cacheSetMock).toHaveBeenCalledWith(
        `project-usage:${userId}`,
        result,
        300,
      );
    });

    it('skips header row at rowIndex 1', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(1, '20/03/2026', 'HEADER'),
        makeRow(2, '20/03/2026', 'ProjectA'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage).toEqual([
        { project: 'ProjectA', count: 1, lastUsedDate: '20/03/2026' },
      ]);
    });

    it('filters out rows with empty or whitespace projects', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', ''),
        makeRow(3, '20/03/2026', '   '),
        makeRow(4, '20/03/2026', 'ProjectA'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage).toEqual([
        { project: 'ProjectA', count: 1, lastUsedDate: '20/03/2026' },
      ]);
    });

    it('aggregates count case-insensitively', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'projecta'),
        makeRow(3, '21/03/2026', 'ProjectA'),
        makeRow(4, '22/03/2026', 'PROJECTA'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage).toHaveLength(1);
      expect(result.usage[0].count).toBe(3);
    });

    it('sorts by count DESC then by project name', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '20/03/2026', 'Beta'),
        makeRow(3, '20/03/2026', 'Alpha'),
        makeRow(4, '20/03/2026', 'Alpha'),
        makeRow(5, '20/03/2026', 'Gamma'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage.map((u) => u.project)).toEqual([
        'Alpha',
        'Beta',
        'Gamma',
      ]);
    });

    it('tracks the most recent date per project', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(2, '22/03/2026', 'ProjectA'),
        makeRow(3, '20/03/2026', 'ProjectA'),
        makeRow(4, '21/03/2026', 'ProjectA'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage[0].lastUsedDate).toBe('22/03/2026');
    });

    it('uses rowIndex as tiebreaker when dates are equal', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser());
      getWeekEntriesMock.mockResolvedValue([
        makeRow(5, '20/03/2026', 'ProjectA'),
        makeRow(2, '20/03/2026', 'ProjectA'),
        makeRow(3, '20/03/2026', 'ProjectA'),
      ]);

      const result = await service.getProjectUsage(userId, accessToken);

      expect(result.usage[0].count).toBe(3);
      expect(result.usage[0].lastUsedDate).toBe('20/03/2026');
    });

    it('throws when user has no spreadsheet configured', async () => {
      cacheGetMock.mockResolvedValue(null);
      findByGoogleIdMock.mockResolvedValue(makeUser({ spreadsheetId: null }));

      await expect(
        service.getProjectUsage(userId, accessToken),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
