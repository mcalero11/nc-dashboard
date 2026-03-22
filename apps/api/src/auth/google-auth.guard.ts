import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';

export class GoogleAuthRedirectException extends HttpException {
  constructor(public readonly redirectUrl: string) {
    super('Google auth failed', HttpStatus.FOUND);
  }
}

@Injectable()
export class GoogleInitGuard extends AuthGuard('google') {
  getAuthenticateOptions(): Record<string, unknown> {
    return {
      accessType: 'offline',
      prompt: 'consent',
    };
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  handleRequest<T>(err: Error | null, user: T): T {
    if (err || !user) {
      const frontendUrl = this.configService.get<string>('FRONTEND_URL');
      throw new GoogleAuthRedirectException(
        `${frontendUrl}/?error=${encodeURIComponent('Google authorization is required to use this app.')}`,
      );
    }
    return user;
  }
}
