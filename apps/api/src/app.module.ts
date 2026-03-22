import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { APP_GUARD } from '@nestjs/core';
import { validate } from './config/env.validation.js';
import { AuthModule } from './auth/auth.module.js';
import { UserModule } from './user/user.module.js';
import { SheetsModule } from './sheets/sheets.module.js';
import { QueueModule } from './queue/queue.module.js';
import { TimeEntryModule } from './time-entry/time-entry.module.js';
import { HealthModule } from './health/health.module.js';
import { ResourceAllocationModule } from './resource-allocation/resource-allocation.module.js';
import { dataSourceOptions } from './data-source.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRoot(dataSourceOptions),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60000, limit: 60 }],
    }),
    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        connection: {
          url: configService.get<string>('REDIS_URL'),
        },
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    UserModule,
    SheetsModule,
    QueueModule,
    TimeEntryModule,
    HealthModule,
    ResourceAllocationModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
