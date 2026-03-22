import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { UserModule } from '../user/user.module.js';
import { OpsSyncConfig } from './entities/ops-sync-config.entity.js';
import { OpsProject } from './entities/ops-project.entity.js';
import { OpsAllocation } from './entities/ops-allocation.entity.js';
import { ResourceAllocationController } from './resource-allocation.controller.js';
import { ResourceAllocationService } from './resource-allocation.service.js';
import { ResourceAllocationSyncService } from './resource-allocation-sync.service.js';
import { ResourceAllocationSheetsService } from './resource-allocation-sheets.service.js';
import { ResourceAllocationSyncProcessor } from './resource-allocation-sync.processor.js';
import { OPS_SYNC_QUEUE } from './resource-allocation.types.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([OpsSyncConfig, OpsProject, OpsAllocation]),
    BullModule.registerQueue({
      name: OPS_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 10000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    }),
    UserModule,
  ],
  controllers: [ResourceAllocationController],
  providers: [
    ResourceAllocationService,
    ResourceAllocationSyncService,
    ResourceAllocationSheetsService,
    ResourceAllocationSyncProcessor,
  ],
})
export class ResourceAllocationModule {}
