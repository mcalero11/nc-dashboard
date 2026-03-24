import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { JwtPayload } from './auth.types.js';

@Injectable()
export class InternalUserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ user?: JwtPayload }>();
    const user = request.user;

    if (!user || user.userType !== 'internal') {
      throw new ForbiddenException('Access restricted to internal users.');
    }

    return true;
  }
}
