import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export function buildAuthCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const sessionMaxAge = configService.get<number>('SESSION_MAX_AGE') ?? 604800;

  return {
    httpOnly: true,
    secure: configService.get('NODE_ENV') === 'production',
    sameSite: 'lax',
    maxAge: sessionMaxAge * 1000,
    path: '/',
  };
}
