import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service.js';
import { UserService } from '../user/user.service.js';
import { GoogleProfile } from './auth.types.js';
import { User } from '../user/user.entity.js';
import { InvalidRefreshTokenError } from '../common/errors/invalid-refresh-token.error.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';

jest.mock('../common/utils/google-token.utils.js', () => ({
  exchangeRefreshToken: jest.fn().mockResolvedValue({
    accessToken: 'new-access-token',
    expiresIn: 3600,
  }),
}));

jest.mock('../common/utils/encryption.utils.js', () => ({
  encrypt: jest.fn().mockReturnValue('encrypted-value'),
  decrypt: jest.fn().mockReturnValue('decrypted-refresh-token'),
}));

const exchangeRefreshTokenMock = jest.mocked(exchangeRefreshToken);

describe('AuthService', () => {
  let authService: AuthService;
  let userService: jest.Mocked<UserService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockEncryptionKey = 'a'.repeat(64);

  function makeUser(overrides: Partial<User> = {}): User {
    return {
      googleId: 'google-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      spreadsheetId: null,
      encryptedRefreshToken: null,
      opsSheetAccess: 'unchecked',
      opsPersonAliases: [],
      userType: 'internal',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides,
    };
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UserService,
          useValue: {
            createOrUpdate: jest.fn(),
            findByGoogleId: jest.fn(),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'TOKEN_ENCRYPTION_KEY') return mockEncryptionKey;
              if (key === 'SESSION_MAX_AGE') return 604800;
              if (key === 'GOOGLE_CLIENT_ID') return 'mock-client-id';
              if (key === 'GOOGLE_CLIENT_SECRET') return 'mock-client-secret';
              if (key === 'ALLOWED_DOMAINS') return 'example.com';
              if (key === 'ALLOWED_EMAILS') return '';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    authService = module.get(AuthService);
    userService = module.get(UserService);
    jwtService = module.get(JwtService);
  });

  describe('googleLogin', () => {
    const baseProfile: GoogleProfile = {
      googleId: 'google-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    };

    it('should create a new user with encrypted refresh token', async () => {
      const savedUser = makeUser({
        encryptedRefreshToken: 'encrypted-value',
      });
      userService.createOrUpdate.mockResolvedValue(savedUser);

      const result = await authService.googleLogin(baseProfile);

      expect(result).toEqual({
        jwt: 'mock-jwt-token',
        userType: 'internal',
      });
      const callArg = userService.createOrUpdate.mock.calls[0][0];
      expect(callArg.googleId).toBe('google-123');
      expect(callArg.email).toBe('test@example.com');
      expect(callArg.userType).toBe('internal');
      expect(callArg.encryptedRefreshToken).toBeDefined();
      expect(callArg.encryptedRefreshToken).not.toBe('refresh-token');
    });

    it('should preserve spreadsheetId on re-login (not pass spreadsheetId: null)', async () => {
      const existingUser = makeUser({
        spreadsheetId: 'sheet-abc',
        encryptedRefreshToken: 'old-encrypted',
      });
      userService.createOrUpdate.mockResolvedValue(existingUser);

      await authService.googleLogin(baseProfile);

      const callArg = userService.createOrUpdate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('spreadsheetId');
    });

    it('should preserve encryptedRefreshToken when Google omits refresh token', async () => {
      const profileWithoutRefresh: GoogleProfile = {
        ...baseProfile,
        refreshToken: undefined,
      };
      const existingUser = makeUser({
        spreadsheetId: 'sheet-abc',
        encryptedRefreshToken: 'existing-encrypted',
      });
      userService.createOrUpdate.mockResolvedValue(existingUser);

      await authService.googleLogin(profileWithoutRefresh);

      const callArg = userService.createOrUpdate.mock.calls[0][0];
      expect(callArg).not.toHaveProperty('encryptedRefreshToken');
    });

    it('should create external user for unauthorized domain', async () => {
      const unauthorizedProfile: GoogleProfile = {
        ...baseProfile,
        email: 'hacker@evil.com',
      };
      const savedUser = makeUser({
        email: 'hacker@evil.com',
        userType: 'external',
      });
      userService.createOrUpdate.mockResolvedValue(savedUser);

      const result = await authService.googleLogin(unauthorizedProfile);

      expect(result).toEqual({
        jwt: 'mock-jwt-token',
        userType: 'external',
      });
      const callArg = userService.createOrUpdate.mock.calls[0][0];
      expect(callArg.userType).toBe('external');
    });

    it('should accept email from allowed domain (case-insensitive)', async () => {
      const upperCaseProfile: GoogleProfile = {
        ...baseProfile,
        email: 'Test@EXAMPLE.COM',
      };
      const savedUser = makeUser({
        email: 'Test@EXAMPLE.COM',
        encryptedRefreshToken: 'encrypted-value',
      });
      userService.createOrUpdate.mockResolvedValue(savedUser);

      const result = await authService.googleLogin(upperCaseProfile);

      expect(result).toEqual({
        jwt: 'mock-jwt-token',
        userType: 'internal',
      });
    });

    it('should create external user for empty email', async () => {
      const emptyEmailProfile: GoogleProfile = {
        ...baseProfile,
        email: '',
      };
      const savedUser = makeUser({ email: '', userType: 'external' });
      userService.createOrUpdate.mockResolvedValue(savedUser);

      const result = await authService.googleLogin(emptyEmailProfile);

      expect(result.userType).toBe('external');
    });

    it('should accept whitelisted email from non-allowed domain', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          {
            provide: UserService,
            useValue: {
              createOrUpdate: jest.fn().mockResolvedValue(
                makeUser({
                  googleId: 'google-456',
                  email: 'contractor@gmail.com',
                  firstName: 'Contractor',
                  encryptedRefreshToken: 'encrypted-value',
                }),
              ),
            },
          },
          {
            provide: JwtService,
            useValue: {
              sign: jest.fn().mockReturnValue('mock-jwt-token'),
            },
          },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockImplementation((key: string) => {
                if (key === 'TOKEN_ENCRYPTION_KEY') return mockEncryptionKey;
                if (key === 'ALLOWED_DOMAINS') return 'example.com';
                if (key === 'ALLOWED_EMAILS') return 'contractor@gmail.com';
                return undefined;
              }),
            },
          },
        ],
      }).compile();

      const service = module.get(AuthService);
      const gmailProfile: GoogleProfile = {
        ...baseProfile,
        googleId: 'google-456',
        email: 'contractor@gmail.com',
        firstName: 'Contractor',
      };

      const result = await service.googleLogin(gmailProfile);
      expect(result).toEqual({
        jwt: 'mock-jwt-token',
        userType: 'internal',
      });
    });

    it('should return a valid JWT with correct payload including userType', async () => {
      const savedUser = makeUser({
        spreadsheetId: 'sheet-abc',
        encryptedRefreshToken: 'encrypted',
      });
      userService.createOrUpdate.mockResolvedValue(savedUser);

      await authService.googleLogin(baseProfile);

      const signedPayload = jwtService.sign.mock.calls[0]?.[0] as Record<
        string,
        unknown
      >;
      expect(signedPayload).toMatchObject({
        sub: 'google-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        spreadsheetId: 'sheet-abc',
        userType: 'internal',
      });
      expect(typeof signedPayload.sessionStart).toBe('number');
    });
  });

  describe('validateUser', () => {
    it('should return user when found', async () => {
      const user = makeUser();
      userService.findByGoogleId.mockResolvedValue(user);

      const result = await authService.validateUser('google-123');
      expect(result).toEqual(user);
    });

    it('should return null when user not found', async () => {
      userService.findByGoogleId.mockResolvedValue(null);

      const result = await authService.validateUser('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('refreshSession', () => {
    const mockUser = makeUser({
      spreadsheetId: 'sheet-abc',
      encryptedRefreshToken: 'encrypted-token',
    });

    const validDecodedToken = {
      sub: 'google-123',
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      spreadsheetId: 'sheet-abc',
      sessionStart: Math.floor(Date.now() / 1000) - 3600, // 1 hour ago
      userType: 'internal',
    };

    it('should refresh and return a new JWT on happy path', async () => {
      jwtService.verify.mockReturnValue(validDecodedToken);
      userService.findByGoogleId.mockResolvedValue(mockUser);

      const result = await authService.refreshSession('expired-jwt');

      expect(result).toBe('mock-jwt-token');
      expect(jwtService.verify.mock.calls).toEqual([
        ['expired-jwt', { ignoreExpiration: true }],
      ]);
      expect(jwtService.sign.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          sub: 'google-123',
          sessionStart: validDecodedToken.sessionStart,
          userType: 'internal',
        }),
      );
    });

    it('should throw UnauthorizedException when session window is expired', async () => {
      const expiredSessionToken = {
        ...validDecodedToken,
        sessionStart: Math.floor(Date.now() / 1000) - 604801, // > 7 days ago
      };
      jwtService.verify.mockReturnValue(expiredSessionToken);

      await expect(authService.refreshSession('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid JWT', async () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      await expect(authService.refreshSession('bad-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user has no refresh token', async () => {
      jwtService.verify.mockReturnValue(validDecodedToken);
      userService.findByGoogleId.mockResolvedValue({
        ...mockUser,
        encryptedRefreshToken: null,
      });

      await expect(authService.refreshSession('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should clear refresh token and throw when Google token is revoked', async () => {
      jwtService.verify.mockReturnValue(validDecodedToken);
      userService.findByGoogleId.mockResolvedValue(mockUser);
      exchangeRefreshTokenMock.mockRejectedValueOnce(
        new InvalidRefreshTokenError(),
      );
      userService.createOrUpdate.mockResolvedValue(mockUser);

      await expect(authService.refreshSession('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );

      expect(userService.createOrUpdate.mock.calls).toEqual([
        [
          {
            googleId: 'google-123',
            encryptedRefreshToken: null,
          },
        ],
      ]);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      jwtService.verify.mockReturnValue(validDecodedToken);
      userService.findByGoogleId.mockResolvedValue(null);

      await expect(authService.refreshSession('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject refresh when internal user domain is no longer allowed', async () => {
      jwtService.verify.mockReturnValue(validDecodedToken);
      userService.findByGoogleId.mockResolvedValue({
        ...mockUser,
        email: 'user@removed-domain.com',
        userType: 'internal',
      });

      await expect(authService.refreshSession('expired-jwt')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should allow refresh for external user without domain check', async () => {
      const externalUser = makeUser({
        email: 'external@gmail.com',
        userType: 'external',
        spreadsheetId: null,
        encryptedRefreshToken: 'encrypted-token',
      });
      jwtService.verify.mockReturnValue({
        ...validDecodedToken,
        email: 'external@gmail.com',
        userType: 'external',
      });
      userService.findByGoogleId.mockResolvedValue(externalUser);

      const result = await authService.refreshSession('expired-jwt');

      expect(result).toBe('mock-jwt-token');
      expect(jwtService.sign.mock.calls[0]?.[0]).toEqual(
        expect.objectContaining({
          userType: 'external',
        }),
      );
    });
  });
});
