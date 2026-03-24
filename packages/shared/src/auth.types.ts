export type UserType = 'internal' | 'external';

export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  spreadsheetId: string | null;
  sessionStart: number;
  userType: UserType;
}
