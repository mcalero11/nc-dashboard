import { ForbiddenException, ExecutionContext } from '@nestjs/common';
import { InternalUserGuard } from './internal-user.guard.js';

function makeContext(user: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  } as unknown as ExecutionContext;
}

describe('InternalUserGuard', () => {
  const guard = new InternalUserGuard();

  it('should allow internal users', () => {
    const ctx = makeContext({ userType: 'internal' });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw ForbiddenException for external users', () => {
    const ctx = makeContext({ userType: 'external' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx)).toThrow(
      'Access restricted to internal users.',
    );
  });

  it('should throw ForbiddenException when user is undefined', () => {
    const ctx = makeContext(undefined);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when userType is missing', () => {
    const ctx = makeContext({ email: 'test@example.com' });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });
});
