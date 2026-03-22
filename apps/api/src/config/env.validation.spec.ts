import 'reflect-metadata';
import { validate } from './env.validation.js';

describe('env validation', () => {
  const validConfig = {
    PORT: 3001,
    NODE_ENV: 'test',
    FRONTEND_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'client-id',
    GOOGLE_CLIENT_SECRET: 'client-secret',
    GOOGLE_CALLBACK_URL: 'http://localhost:3001/api/auth/google/callback',
    JWT_SECRET: 'jwt-secret',
    JWT_EXPIRY: 3600,
    TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
    REDIS_URL: 'redis://localhost:6379',
    SESSION_MAX_AGE: 604800,
    ALLOWED_DOMAINS: 'example.com',
    ALLOWED_EMAILS: '',
    OPS_SHEET_NAME: 'OPS Sheet',
    OPS_SHEET_TAB_NAME: 'Allocations',
    OPS_SYNC_INTERVAL_MS: 600000,
    OPS_SYNC_WEEKS_AHEAD: 12,
    OPS_SYNC_WEEKS_BEHIND: 4,
  };

  it('accepts a 64-character hex encryption key', () => {
    expect(validate(validConfig)).toMatchObject({
      TOKEN_ENCRYPTION_KEY: validConfig.TOKEN_ENCRYPTION_KEY,
    });
  });

  it('rejects encryption keys that are not 64-character hex', () => {
    expect(() =>
      validate({
        ...validConfig,
        TOKEN_ENCRYPTION_KEY: 'not-a-valid-key',
      }),
    ).toThrow(/TOKEN_ENCRYPTION_KEY.*matches/);
  });
});
