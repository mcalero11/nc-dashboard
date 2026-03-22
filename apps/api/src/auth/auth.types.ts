export type { JwtPayload } from '@nc-dashboard/shared';

export interface GoogleProfile {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  accessToken: string;
  refreshToken?: string;
}
