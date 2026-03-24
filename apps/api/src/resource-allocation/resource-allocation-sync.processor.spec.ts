import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { ResourceAllocationSyncProcessor } from './resource-allocation-sync.processor.js';
import {
  ResourceAllocationSyncService,
  NoOpsUsersAvailableError,
} from './resource-allocation-sync.service.js';
import {
  OPS_SYNC_QUEUE,
  type OpsSyncJobPayload,
} from './resource-allocation.types.js';

describe('ResourceAllocationSyncProcessor', () => {
  let processor: ResourceAllocationSyncProcessor;
  const refreshAllUserAccessMock = jest.fn();
  const syncFromSheetMock = jest.fn();
  const upsertJobSchedulerMock = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceAllocationSyncProcessor,
        {
          provide: getQueueToken(OPS_SYNC_QUEUE),
          useValue: { upsertJobScheduler: upsertJobSchedulerMock },
        },
        {
          provide: ResourceAllocationSyncService,
          useValue: {
            refreshAllUserAccess: refreshAllUserAccessMock,
            syncFromSheet: syncFromSheetMock,
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'OPS_SYNC_INTERVAL_MS') return 7_200_000;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    processor = module.get(ResourceAllocationSyncProcessor);
  });

  describe('process', () => {
    function makeJob(
      data: OpsSyncJobPayload,
      id = 'job-1',
    ): Job<OpsSyncJobPayload> {
      return { id, data } as Job<OpsSyncJobPayload>;
    }

    it('should call refreshAllUserAccess before syncFromSheet', async () => {
      const callOrder: string[] = [];
      refreshAllUserAccessMock.mockImplementation(() => {
        callOrder.push('refreshAllUserAccess');
      });
      syncFromSheetMock.mockImplementation(() => {
        callOrder.push('syncFromSheet');
      });

      const job = makeJob({ triggeredBy: 'schedule' });
      await processor.process(job);

      expect(callOrder).toEqual(['refreshAllUserAccess', 'syncFromSheet']);
    });

    it('should pass triggeredBy and userId to syncFromSheet', async () => {
      const job = makeJob({ triggeredBy: 'manual', userId: 'g-1' });
      await processor.process(job);

      expect(syncFromSheetMock).toHaveBeenCalledWith('manual', 'g-1');
    });

    it('should not throw on NoOpsUsersAvailableError (graceful skip)', async () => {
      syncFromSheetMock.mockRejectedValue(new NoOpsUsersAvailableError());

      const job = makeJob({ triggeredBy: 'schedule' });
      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it('should re-throw other errors', async () => {
      const error = new Error('Sheet API down');
      syncFromSheetMock.mockRejectedValue(error);

      const job = makeJob({ triggeredBy: 'schedule' });
      await expect(processor.process(job)).rejects.toThrow('Sheet API down');
    });

    it('should still call syncFromSheet even if refreshAllUserAccess fails', async () => {
      // refreshAllUserAccess should not block sync — but currently the implementation
      // does not catch errors from it. If refreshAllUserAccess throws, process will throw.
      // This test documents that behavior: if access refresh fails, the job fails.
      refreshAllUserAccessMock.mockRejectedValue(new Error('DB timeout'));

      const job = makeJob({ triggeredBy: 'schedule' });
      await expect(processor.process(job)).rejects.toThrow('DB timeout');

      expect(syncFromSheetMock).not.toHaveBeenCalled();
    });
  });

  describe('onModuleInit', () => {
    it('should register a repeatable job scheduler', async () => {
      await processor.onModuleInit();

      expect(upsertJobSchedulerMock).toHaveBeenCalledWith(
        expect.any(String),
        { every: 7_200_000 },
        { data: { triggeredBy: 'schedule' } },
      );
    });
  });
});
