import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { UserModule } from '../user/user.module.js';
import { SheetsController } from './sheets.controller.js';
import { SheetsService } from './sheets.service.js';
import { SheetsDiscoveryService } from './sheets-discovery.service.js';

@Module({
  imports: [AuthModule, UserModule],
  controllers: [SheetsController],
  providers: [SheetsService, SheetsDiscoveryService],
  exports: [SheetsService, SheetsDiscoveryService],
})
export class SheetsModule {}
