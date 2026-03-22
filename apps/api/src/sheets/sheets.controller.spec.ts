import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { SheetsController } from './sheets.controller.js';
import { SheetsService } from './sheets.service.js';
import { SheetsDiscoveryService } from './sheets-discovery.service.js';
import { UserService } from '../user/user.service.js';
import { AuthService } from '../auth/auth.service.js';
import { User } from '../user/user.entity.js';

jest.mock('../common/utils/encryption.utils.js', () => ({
  decrypt: jest.fn().mockReturnValue('refresh-token'),
}));

jest.mock('../common/utils/google-token.utils.js', () => ({
  exchangeRefreshToken: jest.fn().mockResolvedValue({
    accessToken: 'access-token',
    expiresIn: 3600,
  }),
}));

describe('SheetsController', () => {
  let controller: SheetsController;
  let userService: jest.Mocked<UserService>;
  let authService: jest.Mocked<AuthService>;

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      googleId: 'google-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      spreadsheetId: 'sheet-old',
      encryptedRefreshToken: 'encrypted-token',
      opsSheetAccess: 'unchecked',
      opsPersonAliases: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SheetsController],
      providers: [
        {
          provide: SheetsService,
          useValue: {
            validateSpreadsheet: jest.fn().mockResolvedValue({ valid: true }),
          },
        },
        {
          provide: SheetsDiscoveryService,
          useValue: {
            discoverSheet: jest.fn(),
          },
        },
        {
          provide: UserService,
          useValue: {
            findByGoogleId: jest.fn(),
            updateSpreadsheetId: jest.fn(),
          },
        },
        {
          provide: AuthService,
          useValue: {
            generateJwt: jest.fn().mockReturnValue('updated-jwt'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'NODE_ENV') return 'test';
              if (key === 'SESSION_MAX_AGE') return 604800;
              if (key === 'TOKEN_ENCRYPTION_KEY') return 'a'.repeat(64);
              if (key === 'GOOGLE_CLIENT_ID') return 'client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'client-secret';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(SheetsController);
    userService = module.get(UserService);
    authService = module.get(AuthService);
  });

  it('preserves the original session start and cookie lifetime when selecting a sheet', async () => {
    userService.findByGoogleId.mockResolvedValue(makeUser());
    userService.updateSpreadsheetId.mockResolvedValue(
      makeUser({ spreadsheetId: 'sheet-new' }),
    );

    const req = {
      user: {
        sub: 'google-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        spreadsheetId: 'sheet-old',
        sessionStart: 1700000000,
      },
    } as unknown as Request;

    const cookie = jest.fn();
    const json = jest.fn();
    const res = {
      cookie,
      json,
    } as unknown as Response;

    await controller.select(req, res, { spreadsheetId: 'sheet-new' });

    expect(authService.generateJwt.mock.calls).toEqual([
      [
        'google-123',
        'test@example.com',
        'Test',
        'User',
        'sheet-new',
        1700000000,
      ],
    ]);
    expect(cookie.mock.calls).toEqual([
      [
        'jwt',
        'updated-jwt',
        {
          httpOnly: true,
          secure: false,
          sameSite: 'lax',
          maxAge: 604800000,
          path: '/',
        },
      ],
    ]);
    expect(json.mock.calls).toEqual([
      [
        {
          message: 'Sheet connected successfully',
          spreadsheetId: 'sheet-new',
        },
      ],
    ]);
  });
});
