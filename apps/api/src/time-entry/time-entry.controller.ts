import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { InternalUserGuard } from '../auth/internal-user.guard.js';
import { JwtPayload } from '../auth/auth.types.js';
import { UserService } from '../user/user.service.js';
import { decrypt } from '../common/utils/encryption.utils.js';
import { exchangeRefreshToken } from '../common/utils/google-token.utils.js';
import { TimeEntryService } from './time-entry.service.js';
import {
  CreateTimeEntryDto,
  RecentTasksQueryDto,
  TaskSummaryQueryDto,
  UpdateTimeEntryDto,
} from './time-entry.dto.js';

@Controller('time-entries')
@UseGuards(JwtAuthGuard, InternalUserGuard)
export class TimeEntryController {
  constructor(
    private readonly timeEntryService: TimeEntryService,
    private readonly userService: UserService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Req() req: Request, @Body() dto: CreateTimeEntryDto) {
    const user = req.user as JwtPayload;
    return this.timeEntryService.createEntry(user.sub, dto);
  }

  @Get('recent-tasks')
  async getRecentTasks(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: RecentTasksQueryDto,
  ) {
    const { project } = query;
    const jwtPayload = req.user as JwtPayload;
    const accessToken = await this.getAccessToken(jwtPayload.sub);
    return this.timeEntryService.getRecentTasks(
      jwtPayload.sub,
      accessToken,
      project,
    );
  }

  @Get('task-summary')
  async getTaskSummary(
    @Req() req: Request,
    @Query(new ValidationPipe({ transform: true, whitelist: true }))
    query: TaskSummaryQueryDto,
  ) {
    const jwtPayload = req.user as JwtPayload;
    const accessToken = await this.getAccessToken(jwtPayload.sub);
    return this.timeEntryService.getTaskSummary(
      jwtPayload.sub,
      accessToken,
      query.task,
    );
  }

  @Get('week')
  async getWeek(
    @Req() req: Request,
    @Query('timezone') timezone?: string,
    @Query('weekOffset') weekOffsetStr?: string,
  ) {
    const jwtPayload = req.user as JwtPayload;
    const accessToken = await this.getAccessToken(jwtPayload.sub);

    const clampedOffset = Math.min(
      0,
      Math.max(-52, parseInt(weekOffsetStr ?? '0', 10) || 0),
    );
    return this.timeEntryService.getWeekEntries(
      jwtPayload.sub,
      accessToken,
      timezone,
      clampedOffset,
    );
  }

  private async getAccessToken(userId: string): Promise<string> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user?.encryptedRefreshToken) {
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
    return accessToken;
  }

  @Put(':rowIndex')
  @HttpCode(HttpStatus.ACCEPTED)
  update(
    @Req() req: Request,
    @Param('rowIndex', ParseIntPipe) rowIndex: number,
    @Body() dto: UpdateTimeEntryDto,
  ) {
    const user = req.user as JwtPayload;
    return this.timeEntryService.updateEntry(user.sub, rowIndex, dto);
  }

  @Delete(':rowIndex')
  @HttpCode(HttpStatus.ACCEPTED)
  delete(
    @Req() req: Request,
    @Param('rowIndex', ParseIntPipe) rowIndex: number,
  ) {
    const user = req.user as JwtPayload;
    return this.timeEntryService.deleteEntry(user.sub, rowIndex);
  }

  @Get('jobs/:jobId/status')
  getJobStatus(@Req() req: Request, @Param('jobId') jobId: string) {
    const user = req.user as JwtPayload;
    return this.timeEntryService.getJobStatus(user.sub, jobId);
  }
}
