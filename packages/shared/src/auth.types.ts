export interface JwtPayload {
  sub: string;
  email: string;
  firstName: string;
  lastName: string;
  spreadsheetId: string | null;
  sessionStart: number;
}
