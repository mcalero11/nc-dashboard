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
      const cached = { tasks: ['HPH-01', 'HPH-02'] };
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

      expect(result.tasks).toEqual(['HPH-02', 'HPH-01']);
      expect(cacheSetMock).toHaveBeenCalledWith(
        `recent-tasks:${userId}`,
        { tasks: ['HPH-02', 'HPH-01'] },
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

      expect(result.tasks).toEqual(['HPH-02', 'HPH-01']);
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

      expect(result.tasks).toEqual(['HPH-01']);
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

      expect(result.tasks).toEqual(['NEWER-SECOND', 'NEWER-FIRST', 'OLD']);
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

      expect(result.tasks).toEqual(['TASK-C', 'TASK-A']);
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
        { tasks: ['TASK-A'] },
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

      expect(result.tasks).toEqual([]);
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

      expect(result.tasks).toEqual(['TASK-A']);
    });
  });
});
