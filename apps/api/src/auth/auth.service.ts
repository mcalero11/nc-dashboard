import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service.js';
import { encrypt, decrypt } from '../common/utils/encryption.utils.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { InvalidRefreshTokenError } from '../common/errors/invalid-refresh-token.error.js';
import { User } from '../user/user.entity.js';
import { GoogleProfile, JwtPayload } from './auth.types.js';
import type { UserType } from '@nc-dashboard/shared';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private isEmailAllowed(email: string): boolean {
    if (!email || !email.includes('@')) return false;
    const normalizedEmail = email.toLowerCase();

    const allowedEmails =
      this.configService.get<string>('ALLOWED_EMAILS') ?? '';
    const emailList = allowedEmails
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);
    if (emailList.includes(normalizedEmail)) return true;

    const domain = normalizedEmail.split('@').pop()!;
    const allowedDomains = this.configService
      .get<string>('ALLOWED_DOMAINS')!
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter((d) => d.length > 0);
    return allowedDomains.includes(domain);
  }

  async googleLogin(
    profile: GoogleProfile,
  ): Promise<{ jwt: string; userType: UserType }> {
    const userType: UserType = this.isEmailAllowed(profile.email)
      ? 'internal'
      : 'external';

    const encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
    )!;

    const updateData: Partial<User> & Pick<User, 'googleId'> = {
      googleId: profile.googleId,
      email: profile.email,
      firstName: profile.firstName,
      lastName: profile.lastName,
      userType,
    };

    if (profile.refreshToken) {
      updateData.encryptedRefreshToken = encrypt(
        profile.refreshToken,
        encryptionKey,
      );
    }

    const user = await this.userService.createOrUpdate(updateData);

    const jwt = this.generateJwt(
      user.googleId,
      user.email,
      user.firstName,
      user.lastName,
      user.spreadsheetId,
      undefined,
      userType,
    );

    return { jwt, userType };
  }

  async validateUser(googleId: string) {
    return this.userService.findByGoogleId(googleId);
  }

  generateJwt(
    googleId: string,
    email: string,
    firstName: string,
    lastName: string,
    spreadsheetId: string | null,
    sessionStart?: number,
    userType: UserType = 'internal',
  ): string {
    const payload: JwtPayload = {
      sub: googleId,
      email,
      firstName,
      lastName,
      spreadsheetId,
      sessionStart: sessionStart ?? Math.floor(Date.now() / 1000),
      userType,
    };
    return this.jwtService.sign(payload);
  }

  async refreshSession(rawJwt: string): Promise<string> {
    let decoded: JwtPayload;
    try {
      decoded = this.jwtService.verify<JwtPayload>(rawJwt, {
        ignoreExpiration: true,
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const sessionMaxAge =
      this.configService.get<number>('SESSION_MAX_AGE') ?? 604800;
    const now = Math.floor(Date.now() / 1000);
    if (now - decoded.sessionStart > sessionMaxAge) {
      throw new UnauthorizedException('Session expired');
    }

    const user = await this.userService.findByGoogleId(decoded.sub);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.userType !== 'external' && !this.isEmailAllowed(user.email)) {
      throw new UnauthorizedException(
        'Your email domain is no longer authorized.',
      );
    }

    if (!user.encryptedRefreshToken) {
      throw new UnauthorizedException('No refresh token available');
    }

    const encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
    )!;
    const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);

    try {
      await exchangeRefreshToken(
        refreshToken,
        this.configService.get<string>('GOOGLE_CLIENT_ID')!,
        this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      );
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        await this.userService.createOrUpdate({
          googleId: user.googleId,
          encryptedRefreshToken: null,
        });
        throw new UnauthorizedException('Google refresh token revoked');
      }
      throw error;
    }

    return this.generateJwt(
      user.googleId,
      user.email,
      user.firstName,
      user.lastName,
      user.spreadsheetId,
      decoded.sessionStart,
      user.userType,
    );
  }
}
