import {
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service.js';
import { GoogleInitGuard, GoogleAuthGuard } from './google-auth.guard.js';
import { GoogleAuthRedirectFilter } from './google-auth-redirect.filter.js';
import { JwtAuthGuard } from './jwt-auth.guard.js';
import { GoogleProfile, JwtPayload } from './auth.types.js';
import { buildAuthCookieOptions } from './auth-cookie.utils.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Get('google')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(GoogleInitGuard)
  googleAuth() {
    // Passport redirects to Google
  }

  @Get('google/callback')
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleAuthRedirectFilter)
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    if (!req.user) return;

    const profile = req.user as GoogleProfile;
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    try {
      const jwt = await this.authService.googleLogin(profile);
      res.cookie('jwt', jwt, buildAuthCookieOptions(this.configService));
      res.redirect(`${frontendUrl}/dashboard`);
    } catch (error: unknown) {
      const message =
        error instanceof UnauthorizedException
          ? error.message
          : 'Authentication failed. Please try again.';
      res.redirect(`${frontendUrl}/?error=${encodeURIComponent(message)}`);
    }
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60000, limit: 10 } })
  async refresh(@Req() req: Request, @Res() res: Response) {
    const rawJwt =
      typeof req.cookies?.jwt === 'string' ? req.cookies.jwt : undefined;
    if (!rawJwt) {
      throw new UnauthorizedException('No token provided');
    }

    try {
      const newJwt = await this.authService.refreshSession(rawJwt);
      res.cookie('jwt', newJwt, buildAuthCookieOptions(this.configService));
      res.json({ message: 'Token refreshed' });
    } catch (error: unknown) {
      res.clearCookie('jwt');
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Res() res: Response) {
    res.clearCookie('jwt');
    res.json({ message: 'Logged out' });
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request) {
    return req.user as JwtPayload;
  }
}
