import { google } from 'googleapis';
import { InvalidRefreshTokenError } from '../errors/invalid-refresh-token.error.js';

export async function exchangeRefreshToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string,
): Promise<{ accessToken: string; expiresIn: number | null }> {
  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  let credentials;
  try {
    ({ credentials } = await oauth2Client.refreshAccessToken());
  } catch (error) {
    if (error instanceof Error && error.message.includes('invalid_grant')) {
      throw new InvalidRefreshTokenError();
    }
    throw error;
  }

  if (!credentials.access_token) {
    throw new Error('Failed to obtain access token');
  }
  return {
    accessToken: credentials.access_token,
    expiresIn: credentials.expiry_date
      ? Math.floor((credentials.expiry_date - Date.now()) / 1000)
      : null,
  };
}
