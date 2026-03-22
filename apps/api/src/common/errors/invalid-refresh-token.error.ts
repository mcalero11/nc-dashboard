export class InvalidRefreshTokenError extends Error {
  constructor(public readonly userId?: string) {
    super('Refresh token is invalid. Re-authentication required.');
    this.name = 'InvalidRefreshTokenError';
  }
}
