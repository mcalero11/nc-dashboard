import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Patch,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { google } from 'googleapis';
import type { JwtPayload } from '../auth/auth.types.js';
import type {
  SheetStatusResponse,
  ProjectsResponse,
} from '@nc-dashboard/shared';
import { AuthService } from '../auth/auth.service.js';
import { buildAuthCookieOptions } from '../auth/auth-cookie.utils.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { InternalUserGuard } from '../auth/internal-user.guard.js';
import { UserService } from '../user/user.service.js';
import { decrypt } from '../common/utils/encryption.utils.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { SheetsDiscoveryService } from './sheets-discovery.service.js';
import { SheetsService } from './sheets.service.js';
import { SelectSheetDto } from './dto/select-sheet.dto.js';

@Controller('sheets')
@UseGuards(JwtAuthGuard, InternalUserGuard)
export class SheetsController {
  private readonly logger = new Logger(SheetsController.name);

  constructor(
    private readonly sheetsService: SheetsService,
    private readonly sheetsDiscoveryService: SheetsDiscoveryService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private getErrorStatus(error: unknown): number | undefined {
    if (
      typeof error === 'object' &&
      error !== null &&
      'response' in error &&
      typeof error.response === 'object' &&
      error.response !== null &&
      'status' in error.response &&
      typeof error.response.status === 'number'
    ) {
      return error.response.status;
    }

    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      typeof error.code === 'number'
    ) {
      return error.code;
    }

    return undefined;
  }

  @Get('status')
  async status(@Req() req: Request): Promise<SheetStatusResponse> {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);

    if (!user?.spreadsheetId) {
      return {
        connected: false,
        spreadsheetId: null,
        sheetName: null,
        error: 'not_configured',
      };
    }

    const { spreadsheetId } = user;

    let accessToken: string;
    try {
      const encryptionKey = this.configService.get<string>(
        'TOKEN_ENCRYPTION_KEY',
      )!;
      const refreshToken = decrypt(user.encryptedRefreshToken!, encryptionKey);
      const result = await exchangeRefreshToken(
        refreshToken,
        this.configService.get<string>('GOOGLE_CLIENT_ID')!,
        this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      );
      accessToken = result.accessToken;
    } catch (error) {
      this.logger.warn(
        `Token exchange failed for user ${jwtPayload.sub}: ${error}`,
      );
      return {
        connected: false,
        spreadsheetId,
        sheetName: null,
        error: 'token_error',
      };
    }

    try {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });
      const sheets = google.sheets({ version: 'v4', auth });
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'spreadsheetId,properties.title',
      });

      return {
        connected: true,
        spreadsheetId,
        sheetName: response.data.properties?.title ?? null,
      };
    } catch (error: unknown) {
      const status = this.getErrorStatus(error);
      this.logger.warn(
        `Sheet access check failed for ${spreadsheetId}: status=${status}`,
      );

      if (status === 403 || status === 404) {
        return {
          connected: false,
          spreadsheetId,
          sheetName: null,
          error: status === 404 ? 'not_found' : 'access_denied',
        };
      }

      return {
        connected: false,
        spreadsheetId,
        sheetName: null,
        error: 'unknown',
      };
    }
  }

  @Get('projects')
  async projects(@Req() req: Request): Promise<ProjectsResponse> {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);

    if (!user?.spreadsheetId || !user.encryptedRefreshToken) {
      return { projects: [], source: 'none' };
    }

    const { spreadsheetId } = user;

    let accessToken: string;
    try {
      const encryptionKey = this.configService.get<string>(
        'TOKEN_ENCRYPTION_KEY',
      )!;
      const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
      const result = await exchangeRefreshToken(
        refreshToken,
        this.configService.get<string>('GOOGLE_CLIENT_ID')!,
        this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
      );
      accessToken = result.accessToken;
    } catch (error) {
      this.logger.warn(
        `Token exchange failed for user ${jwtPayload.sub}: ${error}`,
      );
      return { projects: [], source: 'none' };
    }

    // Try data validation first (authoritative source of what the sheet accepts)
    const validationProjects = await this.sheetsService.getDataValidation(
      spreadsheetId,
      accessToken,
    );
    if (validationProjects.length > 0) {
      return { projects: validationProjects, source: 'validation' };
    }

    // Fall back to Planning tab
    const planningProjects = await this.sheetsService.getProjectsFromPlanning(
      spreadsheetId,
      accessToken,
    );
    if (planningProjects.length > 0) {
      return { projects: planningProjects, source: 'planning' };
    }

    return { projects: [], source: 'none' };
  }

  @Get('discover')
  async discover(
    @Req() req: Request,
    @Res() res: Response,
    @Query('skipAutoSelect') skipAutoSelect?: string,
  ) {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);
    if (!user || !user.encryptedRefreshToken) {
      throw new BadRequestException('User not found or missing refresh token');
    }

    const encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
    )!;
    const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
    const { accessToken } = await exchangeRefreshToken(
      refreshToken,
      this.configService.get<string>('GOOGLE_CLIENT_ID')!,
      this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
    );

    const results = await this.sheetsDiscoveryService.discoverSheet(
      user.firstName,
      user.lastName,
      accessToken,
    );

    const sheets = results.map((r) => ({
      id: r.spreadsheetId,
      name: r.name,
      modifiedTime: r.modifiedTime,
      ownedByMe: r.ownedByMe,
    }));

    // Auto-select if exactly 1 result (skip when user is changing sheets)
    if (sheets.length === 1 && skipAutoSelect !== 'true') {
      const sheet = sheets[0];
      const { valid } = await this.sheetsService.validateSpreadsheet(
        sheet.id,
        accessToken,
      );

      if (valid) {
        await this.userService.updateSpreadsheetId(jwtPayload.sub, sheet.id);
        this.setJwtCookie(res, jwtPayload, sheet.id);
        this.logger.log(
          `Auto-selected sheet ${sheet.id} for user ${jwtPayload.sub}`,
        );
        return res.json({
          sheets,
          autoSelected: true,
          spreadsheetId: sheet.id,
        });
      }
    }

    return res.json({
      sheets,
      autoSelected: false,
      spreadsheetId: null,
    });
  }

  @Patch('select')
  async select(
    @Req() req: Request,
    @Res() res: Response,
    @Body() dto: SelectSheetDto,
  ) {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);
    if (!user || !user.encryptedRefreshToken) {
      throw new BadRequestException('User not found or missing refresh token');
    }

    // Extract spreadsheet ID from full URL if provided
    const spreadsheetId = this.extractSpreadsheetId(dto.spreadsheetId);

    const encryptionKey = this.configService.get<string>(
      'TOKEN_ENCRYPTION_KEY',
    )!;
    const refreshToken = decrypt(user.encryptedRefreshToken, encryptionKey);
    const { accessToken } = await exchangeRefreshToken(
      refreshToken,
      this.configService.get<string>('GOOGLE_CLIENT_ID')!,
      this.configService.get<string>('GOOGLE_CLIENT_SECRET')!,
    );

    const validation = await this.sheetsService.validateSpreadsheet(
      spreadsheetId,
      accessToken,
    );
    if (!validation.valid) {
      const messages: Record<string, string> = {
        not_google_sheet:
          'This file is not a native Google Sheet. Open the file in Google Drive and use File > Save as Google Sheets, then try again with the new URL.',
        access_denied:
          'Unable to access this sheet. Ensure it is shared with your Google account.',
        not_found: 'Sheet not found. Check the URL or ID and try again.',
      };
      throw new BadRequestException(
        messages[validation.error!] ?? 'Unable to access this sheet.',
      );
    }

    await this.userService.updateSpreadsheetId(jwtPayload.sub, spreadsheetId);
    this.setJwtCookie(res, jwtPayload, spreadsheetId);

    return res.json({
      message: 'Sheet connected successfully',
      spreadsheetId,
    });
  }

  private extractSpreadsheetId(input: string): string {
    const urlMatch = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return urlMatch ? urlMatch[1] : input;
  }

  private setJwtCookie(
    res: Response,
    payload: JwtPayload,
    spreadsheetId: string,
  ) {
    const jwt = this.authService.generateJwt(
      payload.sub,
      payload.email,
      payload.firstName,
      payload.lastName,
      spreadsheetId,
      payload.sessionStart,
      payload.userType,
    );
    res.cookie('jwt', jwt, buildAuthCookieOptions(this.configService));
  }
}
