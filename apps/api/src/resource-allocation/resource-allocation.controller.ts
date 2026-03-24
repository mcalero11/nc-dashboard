import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { InternalUserGuard } from '../auth/internal-user.guard.js';
import { JwtPayload } from '../auth/auth.types.js';
import { UserService } from '../user/user.service.js';
import { ResourceAllocationService } from './resource-allocation.service.js';
import { ResourceAllocationSyncService } from './resource-allocation-sync.service.js';
import { AllocationQueryDto } from './dto/allocation-query.dto.js';
import { RemoveOpsAliasDto } from './dto/remove-ops-alias.dto.js';
import { SaveOpsAliasDto } from './dto/save-ops-alias.dto.js';
import {
  OPS_SYNC_QUEUE,
  type OpsSyncJobPayload,
} from './resource-allocation.types.js';

@Controller('resource-allocation')
@UseGuards(JwtAuthGuard, InternalUserGuard)
export class ResourceAllocationController {
  constructor(
    @InjectQueue(OPS_SYNC_QUEUE)
    private readonly syncQueue: Queue,
    private readonly service: ResourceAllocationService,
    private readonly syncService: ResourceAllocationSyncService,
    private readonly userService: UserService,
  ) {}

  private async assertHasAccess(userId: string): Promise<void> {
    const user = await this.userService.findByGoogleId(userId);
    if (!user || user.opsSheetAccess !== 'has_access') {
      throw new ForbiddenException(
        'You do not have access to the OPS resource allocation sheet',
      );
    }
  }

  @Get('access-status')
  async getAccessStatus(@Req() req: Request) {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);
    return { access: user?.opsSheetAccess ?? 'unchecked' };
  }

  @Post('check-access')
  @HttpCode(HttpStatus.OK)
  async checkAccess(@Req() req: Request) {
    const jwtPayload = req.user as JwtPayload;
    const result = await this.syncService.checkUserAccess(jwtPayload.sub);
    if (result.access !== 'has_access') {
      return result;
    }

    const shouldTriggerSync = await this.service.shouldTriggerSyncAfterAccess();
    if (!shouldTriggerSync) {
      return { ...result, syncTriggered: false };
    }

    const payload: OpsSyncJobPayload = {
      triggeredBy: 'manual',
      userId: jwtPayload.sub,
    };
    await this.syncQueue.add('manual-sync', payload);

    return { ...result, syncTriggered: true };
  }

  @Get('projects')
  async getProjects(@Req() req: Request) {
    const jwtPayload = req.user as JwtPayload;
    await this.assertHasAccess(jwtPayload.sub);
    return this.service.getProjects();
  }

  @Get('allocations')
  async getAllocations(
    @Req() req: Request,
    @Query() query: AllocationQueryDto,
  ) {
    const jwtPayload = req.user as JwtPayload;
    const user = await this.userService.findByGoogleId(jwtPayload.sub);
    if (!user) {
      throw new ForbiddenException('User not found');
    }

    return this.service.getAllocations(user, query);
  }

  @Post('aliases')
  async addAlias(@Req() req: Request, @Body() body: SaveOpsAliasDto) {
    const jwtPayload = req.user as JwtPayload;
    const aliases = await this.userService.addOpsPersonAlias(
      jwtPayload.sub,
      body.alias,
    );
    return { aliases };
  }

  @Delete('aliases')
  async removeAlias(@Req() req: Request, @Body() body: RemoveOpsAliasDto) {
    const jwtPayload = req.user as JwtPayload;
    const aliases = await this.userService.removeOpsPersonAlias(
      jwtPayload.sub,
      body.alias,
    );
    return { aliases };
  }

  @Get('sync-status')
  async getSyncStatus(@Req() req: Request) {
    const jwtPayload = req.user as JwtPayload;
    await this.assertHasAccess(jwtPayload.sub);
    return this.service.getSyncStatus();
  }

  @Post('sync')
  @HttpCode(HttpStatus.ACCEPTED)
  async triggerSync(@Req() req: Request) {
    const jwtPayload = req.user as JwtPayload;
    await this.assertHasAccess(jwtPayload.sub);

    const payload: OpsSyncJobPayload = {
      triggeredBy: 'manual',
      userId: jwtPayload.sub,
    };
    const job = await this.syncQueue.add('manual-sync', payload);
    return { jobId: job.id };
  }
}
