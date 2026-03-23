import { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

export function buildAuthCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const sessionMaxAge = configService.get<number>('SESSION_MAX_AGE') ?? 604800;

  return {
    ...buildClearCookieOptions(configService),
    maxAge: sessionMaxAge * 1000,
  };
}

export function buildClearCookieOptions(
  configService: ConfigService,
): CookieOptions {
  const isProduction = configService.get('NODE_ENV') === 'production';

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    ...(isProduction && { domain: '.mcalero.dev' }),
  };
}
