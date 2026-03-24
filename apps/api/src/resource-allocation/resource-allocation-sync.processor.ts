import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import {
  ResourceAllocationSyncService,
  NoOpsUsersAvailableError,
} from './resource-allocation-sync.service.js';
import {
  OPS_SYNC_QUEUE,
  OPS_SYNC_JOB_SCHEDULER_ID,
  type OpsSyncJobPayload,
} from './resource-allocation.types.js';

@Processor(OPS_SYNC_QUEUE)
export class ResourceAllocationSyncProcessor
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(ResourceAllocationSyncProcessor.name);

  constructor(
    @InjectQueue(OPS_SYNC_QUEUE)
    private readonly queue: Queue,
    private readonly syncService: ResourceAllocationSyncService,
    private readonly configService: ConfigService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const intervalMs =
      this.configService.get<number>('OPS_SYNC_INTERVAL_MS') ?? 7_200_000;

    await this.queue.upsertJobScheduler(
      OPS_SYNC_JOB_SCHEDULER_ID,
      { every: intervalMs },
      { data: { triggeredBy: 'schedule' } as OpsSyncJobPayload },
    );

    this.logger.log(`Registered repeatable sync job every ${intervalMs}ms`);
  }

  async process(job: Job<OpsSyncJobPayload>): Promise<void> {
    const { triggeredBy, userId } = job.data;
    this.logger.log(
      `Processing OPS sync job ${job.id} (triggered by: ${triggeredBy})`,
    );

    try {
      await this.syncService.refreshAllUserAccess();
      await this.syncService.syncFromSheet(triggeredBy, userId);
      this.logger.log(`OPS sync job ${job.id} completed successfully`);
    } catch (error: unknown) {
      if (error instanceof NoOpsUsersAvailableError) {
        this.logger.warn(
          `OPS sync skipped: no users with valid tokens yet. Will retry on next scheduled run.`,
        );
        return; // Don't throw — avoids BullMQ retries for an expected state
      }
      const errMsg = error instanceof Error ? error.message : String(error);
      const errStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`OPS sync job ${job.id} failed: ${errMsg}`, errStack);
      throw error;
    }
  }
}
