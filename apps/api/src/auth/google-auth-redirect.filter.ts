import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { GoogleAuthRedirectException } from './google-auth.guard.js';

@Catch(GoogleAuthRedirectException)
export class GoogleAuthRedirectFilter implements ExceptionFilter {
  catch(exception: GoogleAuthRedirectException, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    res.redirect(exception.redirectUrl);
  }
}
