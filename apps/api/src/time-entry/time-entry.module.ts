import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SheetsModule } from '../sheets/sheets.module.js';
import { UserModule } from '../user/user.module.js';
import { SHEET_SYNC_QUEUE } from '../queue/sheet-sync.types.js';
import { TimeEntryController } from './time-entry.controller.js';
import { TimeEntryService } from './time-entry.service.js';

@Module({
  imports: [
    BullModule.registerQueue({ name: SHEET_SYNC_QUEUE }),
    SheetsModule,
    UserModule,
  ],
  controllers: [TimeEntryController],
  providers: [TimeEntryService],
})
export class TimeEntryModule {}
