import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import {
  ResourceAllocationSyncService,
  NoOpsUsersAvailableError,
} from './resource-allocation-sync.service.js';
import { ResourceAllocationSheetsService } from './resource-allocation-sheets.service.js';
import { UserService } from '../user/user.service.js';
import { OpsSyncConfig } from './entities/ops-sync-config.entity.js';
import { OpsProject } from './entities/ops-project.entity.js';
import { OpsAllocation } from './entities/ops-allocation.entity.js';
import { User } from '../user/user.entity.js';
import { InvalidRefreshTokenError } from '../common/errors/invalid-refresh-token.error.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { decrypt } from '../common/utils/encryption.utils.js';

jest.mock('../common/utils/google-token.utils.js', () => ({
  exchangeRefreshToken: jest.fn().mockResolvedValue({
    accessToken: 'mock-access-token',
    expiresIn: 3600,
  }),
}));

jest.mock('../common/utils/encryption.utils.js', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-value'),
  decrypt: jest.fn().mockReturnValue('decrypted-refresh-token'),
}));

const exchangeRefreshTokenMock = jest.mocked(exchangeRefreshToken);
const decryptMock = jest.mocked(decrypt);

function makeUser(overrides: Partial<User> = {}): User {
  return {
    googleId: 'google-1',
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    spreadsheetId: null,
    encryptedRefreshToken: 'encrypted-token',
    opsSheetAccess: 'unchecked',
    opsPersonAliases: [],
    userType: 'internal',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ResourceAllocationSyncService', () => {
  let service: ResourceAllocationSyncService;

  const findByGoogleIdMock = jest.fn();
  const findUsersWithTokensMock = jest.fn();
  const findUsersWithOpsAccessMock = jest.fn();
  const createOrUpdateMock = jest.fn();
  const updateOpsSheetAccessMock = jest.fn();

  const discoverOpsSheetMock = jest.fn();
  const readSheetDataMock = jest.fn();
  const checkAccessMock = jest.fn();

  const syncConfigFindOneByMock = jest.fn();
  const syncConfigCreateMock = jest.fn();
  const syncConfigSaveMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceAllocationSyncService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue({
              connect: jest.fn(),
              startTransaction: jest.fn(),
              commitTransaction: jest.fn(),
              rollbackTransaction: jest.fn(),
              release: jest.fn(),
              manager: {
                clear: jest.fn(),
                save: jest.fn(),
              },
            }),
          },
        },
        {
          provide: getRepositoryToken(OpsSyncConfig),
          useValue: {
            findOneBy: syncConfigFindOneByMock,
            create: syncConfigCreateMock,
            save: syncConfigSaveMock,
          },
        },
        {
          provide: getRepositoryToken(OpsProject),
          useValue: {},
        },
        {
          provide: getRepositoryToken(OpsAllocation),
          useValue: {},
        },
        {
          provide: UserService,
          useValue: {
            findByGoogleId: findByGoogleIdMock,
            findUsersWithTokens: findUsersWithTokensMock,
            findUsersWithOpsAccess: findUsersWithOpsAccessMock,
            createOrUpdate: createOrUpdateMock,
            updateOpsSheetAccess: updateOpsSheetAccessMock,
          },
        },
        {
          provide: ResourceAllocationSheetsService,
          useValue: {
            discoverOpsSheet: discoverOpsSheetMock,
            readSheetData: readSheetDataMock,
            checkAccess: checkAccessMock,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'TOKEN_ENCRYPTION_KEY') return 'a'.repeat(64);
              if (key === 'GOOGLE_CLIENT_ID') return 'mock-client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'mock-client-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get(ResourceAllocationSyncService);
  });

  describe('refreshAllUserAccess', () => {
    it('should check access for every user with a token', async () => {
      const users = [
        makeUser({ googleId: 'g-1' }),
        makeUser({ googleId: 'g-2' }),
        makeUser({ googleId: 'g-3' }),
      ];
      findUsersWithTokensMock.mockResolvedValue(users);

      const config = {
        id: 'singleton',
        spreadsheetId: 'sheet-123',
        lastSyncAt: null,
        lastSyncStatus: null,
        lastSyncError: null,
        lastSyncUserId: null,
        updatedAt: null,
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      checkAccessMock.mockResolvedValue(true);

      for (const user of users) {
        findByGoogleIdMock.mockResolvedValueOnce(user);
      }

      await service.refreshAllUserAccess();

      expect(findUsersWithTokensMock).toHaveBeenCalledTimes(1);
      expect(updateOpsSheetAccessMock).toHaveBeenCalledTimes(3);
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-1',
        'has_access',
      );
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-2',
        'has_access',
      );
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-3',
        'has_access',
      );
    });

    it('should continue checking remaining users when one fails', async () => {
      const users = [
        makeUser({ googleId: 'g-1' }),
        makeUser({ googleId: 'g-2', encryptedRefreshToken: null }),
        makeUser({ googleId: 'g-3' }),
      ];
      findUsersWithTokensMock.mockResolvedValue(users);

      const config = {
        id: 'singleton',
        spreadsheetId: 'sheet-123',
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      checkAccessMock.mockResolvedValue(true);

      // g-1 succeeds
      findByGoogleIdMock.mockResolvedValueOnce(users[0]);
      // g-2 has no token → checkUserAccess sets no_access
      findByGoogleIdMock.mockResolvedValueOnce(users[1]);
      // g-3 succeeds
      findByGoogleIdMock.mockResolvedValueOnce(users[2]);

      await service.refreshAllUserAccess();

      // g-2 gets no_access (no token), g-1 and g-3 get has_access
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-1',
        'has_access',
      );
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith('g-2', 'no_access');
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-3',
        'has_access',
      );
    });

    it('should handle empty user list gracefully', async () => {
      findUsersWithTokensMock.mockResolvedValue([]);

      await service.refreshAllUserAccess();

      expect(findUsersWithTokensMock).toHaveBeenCalledTimes(1);
      expect(updateOpsSheetAccessMock).not.toHaveBeenCalled();
    });

    it('should not throw when a user check throws an unexpected error', async () => {
      const users = [
        makeUser({ googleId: 'g-1' }),
        makeUser({ googleId: 'g-2' }),
      ];
      findUsersWithTokensMock.mockResolvedValue(users);

      // g-1 throws unexpected error
      findByGoogleIdMock.mockRejectedValueOnce(new Error('DB connection lost'));
      // g-2 succeeds
      const config = {
        id: 'singleton',
        spreadsheetId: 'sheet-123',
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      checkAccessMock.mockResolvedValue(false);
      findByGoogleIdMock.mockResolvedValueOnce(users[1]);

      await expect(service.refreshAllUserAccess()).resolves.toBeUndefined();

      // g-2 still processed despite g-1 failure
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith('g-2', 'no_access');
    });
  });

  describe('checkUserAccess', () => {
    it('should return has_access when user can read the sheet', async () => {
      const user = makeUser({ googleId: 'g-1' });
      findByGoogleIdMock.mockResolvedValue(user);

      const config = {
        id: 'singleton',
        spreadsheetId: 'sheet-123',
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      checkAccessMock.mockResolvedValue(true);

      const result = await service.checkUserAccess('g-1');

      expect(result).toEqual({ access: 'has_access' });
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith(
        'g-1',
        'has_access',
      );
    });

    it('should return no_access when user cannot read the sheet', async () => {
      const user = makeUser({ googleId: 'g-1' });
      findByGoogleIdMock.mockResolvedValue(user);

      const config = {
        id: 'singleton',
        spreadsheetId: 'sheet-123',
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      checkAccessMock.mockResolvedValue(false);

      const result = await service.checkUserAccess('g-1');

      expect(result).toEqual({ access: 'no_access' });
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith('g-1', 'no_access');
    });

    it('should return no_access with token_error when user has no refresh token', async () => {
      const user = makeUser({
        googleId: 'g-1',
        encryptedRefreshToken: null,
      });
      findByGoogleIdMock.mockResolvedValue(user);

      const result = await service.checkUserAccess('g-1');

      expect(result).toEqual({ access: 'no_access', error: 'token_error' });
    });

    it('should return no_access with token_error on InvalidRefreshTokenError', async () => {
      const user = makeUser({ googleId: 'g-1' });
      findByGoogleIdMock.mockResolvedValue(user);

      decryptMock.mockReturnValueOnce('decrypted-token');
      exchangeRefreshTokenMock.mockRejectedValueOnce(
        new InvalidRefreshTokenError(),
      );

      const result = await service.checkUserAccess('g-1');

      expect(result).toEqual({ access: 'no_access', error: 'token_error' });
      expect(updateOpsSheetAccessMock).toHaveBeenCalledWith('g-1', 'no_access');
    });

    it('should discover spreadsheet when config has no spreadsheetId', async () => {
      const user = makeUser({ googleId: 'g-1' });
      findByGoogleIdMock.mockResolvedValue(user);

      const config = {
        id: 'singleton',
        spreadsheetId: null,
      } as OpsSyncConfig;
      syncConfigFindOneByMock.mockResolvedValue(config);
      syncConfigSaveMock.mockResolvedValue(config);
      discoverOpsSheetMock.mockResolvedValue({
        spreadsheetId: 'discovered-sheet',
        name: 'OPS Sheet',
      });
      checkAccessMock.mockResolvedValue(true);

      const result = await service.checkUserAccess('g-1');

      expect(result).toEqual({ access: 'has_access' });
      expect(discoverOpsSheetMock).toHaveBeenCalled();
      expect(syncConfigSaveMock).toHaveBeenCalled();
    });
  });

  describe('acquireAccessToken', () => {
    it('should throw NoOpsUsersAvailableError when no users have access', async () => {
      findUsersWithOpsAccessMock.mockResolvedValue([]);

      await expect(service.acquireAccessToken()).rejects.toThrow(
        NoOpsUsersAvailableError,
      );
    });

    it('should return access token from first available user', async () => {
      const users = [
        makeUser({
          googleId: 'g-1',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'enc-token',
        }),
      ];
      findUsersWithOpsAccessMock.mockResolvedValue(users);

      const result = await service.acquireAccessToken();

      expect(result).toEqual({
        accessToken: 'mock-access-token',
        userId: 'g-1',
      });
    });

    it('should try preferred user first', async () => {
      const users = [
        makeUser({
          googleId: 'g-1',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'enc-token-1',
        }),
        makeUser({
          googleId: 'g-2',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'enc-token-2',
        }),
      ];
      findUsersWithOpsAccessMock.mockResolvedValue(users);

      const result = await service.acquireAccessToken('g-2');

      expect(result.userId).toBe('g-2');
    });

    it('should skip users with invalid refresh tokens and clear their token', async () => {
      exchangeRefreshTokenMock
        .mockRejectedValueOnce(new InvalidRefreshTokenError())
        .mockResolvedValueOnce({
          accessToken: 'fallback-token',
          expiresIn: 3600,
        });

      const users = [
        makeUser({
          googleId: 'g-bad',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'bad-token',
        }),
        makeUser({
          googleId: 'g-good',
          opsSheetAccess: 'has_access',
          encryptedRefreshToken: 'good-token',
        }),
      ];
      findUsersWithOpsAccessMock.mockResolvedValue(users);

      const result = await service.acquireAccessToken();

      expect(result).toEqual({
        accessToken: 'fallback-token',
        userId: 'g-good',
      });
      expect(createOrUpdateMock).toHaveBeenCalledWith({
        googleId: 'g-bad',
        encryptedRefreshToken: null,
      });
    });
  });
});
