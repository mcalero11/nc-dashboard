import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { UserModule } from '../user/user.module.js';
import { SheetsModule } from '../sheets/sheets.module.js';
import { SheetSyncProcessor } from './sheet-sync.processor.js';
import { SHEET_SYNC_QUEUE } from './sheet-sync.types.js';

@Module({
  imports: [
    BullModule.registerQueue({
      name: SHEET_SYNC_QUEUE,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 86400 },
        removeOnFail: { age: 604800 },
      },
    }),
    UserModule,
    SheetsModule,
  ],
  providers: [SheetSyncProcessor],
})
export class QueueModule {}
