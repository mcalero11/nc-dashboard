import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { SheetSyncProcessor } from './sheet-sync.processor.js';
import { SheetsService } from '../sheets/sheets.service.js';
import { UserService } from '../user/user.service.js';
import { CacheService } from '../cache/cache.service.js';
import { isWithinCurrentWeek } from '../common/utils/date.utils.js';
import type { SheetSyncJobPayload } from './sheet-sync.types.js';

jest.mock('../common/utils/google-token.utils.js', () => ({
  exchangeRefreshToken: jest.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    expiresIn: 3600,
  }),
}));

jest.mock('../common/utils/encryption.utils.js', () => ({
  decrypt: jest.fn().mockReturnValue('decrypted-refresh-token'),
}));

jest.mock('../common/utils/date.utils.js', () => ({
  parseDDMMYYYY: jest.fn().mockReturnValue(new Date('2026-03-23')),
  isWithinCurrentWeek: jest.fn().mockReturnValue(true),
}));

describe('SheetSyncProcessor', () => {
  let processor: SheetSyncProcessor;

  const appendRowMock = jest.fn().mockResolvedValue(5);
  const updateRowMock = jest.fn();
  const getRowMock = jest.fn();
  const clearRowMock = jest.fn();
  const cacheDelMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SheetSyncProcessor,
        {
          provide: SheetsService,
          useValue: {
            appendRow: appendRowMock,
            updateRow: updateRowMock,
            getRow: getRowMock,
            clearRow: clearRowMock,
          },
        },
        {
          provide: UserService,
          useValue: {
            findByGoogleId: jest.fn().mockResolvedValue({
              encryptedRefreshToken: 'enc-token',
            }),
            createOrUpdate: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              const config: Record<string, string> = {
                TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
                GOOGLE_CLIENT_ID: 'client-id',
                GOOGLE_CLIENT_SECRET: 'client-secret',
              };
              return config[key];
            }),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
            del: cacheDelMock,
          },
        },
      ],
    }).compile();

    processor = module.get(SheetSyncProcessor);
  });

  function makeJob(
    data: SheetSyncJobPayload,
    id = 'job-1',
  ): Job<SheetSyncJobPayload> {
    return { id, data } as Job<SheetSyncJobPayload>;
  }

  describe('append', () => {
    it('calls appendRow with correct spreadsheetId, accessToken, and row data', async () => {
      const row: SheetSyncJobPayload['row'] = [
        '23/03/2026',
        'Project',
        'HPH-01',
        1,
        '',
      ];
      const job = makeJob({
        type: 'append',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        row,
      });

      await processor.process(job);

      expect(appendRowMock).toHaveBeenCalledWith(
        'sheet-1',
        'new-access-token',
        row,
      );
    });

    it('throws when row data is missing', async () => {
      const job = makeJob({
        type: 'append',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
      });

      await expect(processor.process(job)).rejects.toThrow(
        'Row data required for append',
      );
    });
  });

  describe('update', () => {
    it('calls updateRow with correct arguments after validating existing row', async () => {
      getRowMock.mockResolvedValue([
        '23/03/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);
      const row: SheetSyncJobPayload['row'] = [
        '23/03/2026',
        'Project',
        'HPH-02',
        2,
        'notes',
      ];
      const job = makeJob({
        type: 'update',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
        row,
      });

      await processor.process(job);

      expect(getRowMock).toHaveBeenCalledWith('sheet-1', 'new-access-token', 5);
      expect(updateRowMock).toHaveBeenCalledWith(
        'sheet-1',
        'new-access-token',
        5,
        row,
      );
    });

    it('rejects update when existing row date is not in current week', async () => {
      getRowMock.mockResolvedValue([
        '01/01/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);
      (isWithinCurrentWeek as jest.Mock).mockReturnValueOnce(false);

      const job = makeJob({
        type: 'update',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
        row: ['01/01/2026', 'Project', 'HPH-02', 2, ''],
      });

      await expect(processor.process(job)).rejects.toThrow(
        'not in the current week',
      );
      expect(updateRowMock).not.toHaveBeenCalled();
    });

    it('rejects update when row does not exist', async () => {
      getRowMock.mockResolvedValue([]);

      const job = makeJob({
        type: 'update',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 99,
        row: ['23/03/2026', 'Project', 'HPH-02', 2, ''],
      });

      await expect(processor.process(job)).rejects.toThrow(
        'does not exist in the sheet',
      );
    });
  });

  describe('clear', () => {
    it('calls clearRow with correct arguments after validating existing row', async () => {
      getRowMock.mockResolvedValue([
        '23/03/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);
      const job = makeJob({
        type: 'clear',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
      });

      await processor.process(job);

      expect(getRowMock).toHaveBeenCalledWith('sheet-1', 'new-access-token', 5);
      expect(clearRowMock).toHaveBeenCalledWith(
        'sheet-1',
        'new-access-token',
        5,
      );
    });

    it('rejects clear when existing row date is not in current week', async () => {
      getRowMock.mockResolvedValue([
        '15/01/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);
      (isWithinCurrentWeek as jest.Mock).mockReturnValueOnce(false);

      const job = makeJob({
        type: 'clear',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
      });

      await expect(processor.process(job)).rejects.toThrow(
        'not in the current week',
      );
      expect(clearRowMock).not.toHaveBeenCalled();
    });
  });

  describe('token resolution', () => {
    it('throws when user has no refresh token', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          SheetSyncProcessor,
          {
            provide: SheetsService,
            useValue: {
              appendRow: appendRowMock,
              updateRow: updateRowMock,
              getRow: getRowMock,
              clearRow: clearRowMock,
            },
          },
          {
            provide: UserService,
            useValue: {
              findByGoogleId: jest.fn().mockResolvedValue({
                encryptedRefreshToken: null,
              }),
              createOrUpdate: jest.fn(),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue('dummy'),
            },
          },
          {
            provide: CacheService,
            useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
          },
        ],
      }).compile();

      const proc = module.get(SheetSyncProcessor);
      const job = makeJob({
        type: 'append',
        userId: 'user-no-token',
        spreadsheetId: 'sheet-1',
        row: ['23/03/2026', 'Project', 'HPH-01', 1, ''],
      });

      await expect(proc.process(job)).rejects.toThrow(
        'not found or missing refresh token',
      );
    });
  });

  describe('cache invalidation', () => {
    it('invalidates recent-tasks cache after append', async () => {
      const job = makeJob({
        type: 'append',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        row: ['23/03/2026', 'Project', 'HPH-01', 1, ''],
      });

      await processor.process(job);

      expect(appendRowMock).toHaveBeenCalled();
      expect(cacheDelMock).toHaveBeenCalledWith('recent-tasks:user-1');
    });

    it('invalidates recent-tasks cache after update', async () => {
      getRowMock.mockResolvedValue([
        '23/03/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);

      const job = makeJob({
        type: 'update',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
        row: ['23/03/2026', 'Project', 'HPH-02', 1, ''],
      });

      await processor.process(job);

      expect(updateRowMock).toHaveBeenCalled();
      expect(cacheDelMock).toHaveBeenCalledWith('recent-tasks:user-1');
    });

    it('invalidates recent-tasks cache after clear', async () => {
      getRowMock.mockResolvedValue([
        '23/03/2026',
        'Project',
        'HPH-01',
        '1',
        '',
      ]);

      const job = makeJob({
        type: 'clear',
        userId: 'user-1',
        spreadsheetId: 'sheet-1',
        rowIndex: 5,
      });

      await processor.process(job);

      expect(clearRowMock).toHaveBeenCalled();
      expect(cacheDelMock).toHaveBeenCalledWith('recent-tasks:user-1');
    });
  });
});
