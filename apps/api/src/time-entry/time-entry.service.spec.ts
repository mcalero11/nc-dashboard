import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { TimeEntryService } from './time-entry.service.js';
import { SHEET_SYNC_QUEUE } from '../queue/sheet-sync.types.js';
import { SheetsService } from '../sheets/sheets.service.js';
import { UserService } from '../user/user.service.js';

describe('TimeEntryService', () => {
  let service: TimeEntryService;
  const queue = {
    add: jest.fn(),
    getJob: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TimeEntryService,
        {
          provide: getQueueToken(SHEET_SYNC_QUEUE),
          useValue: queue,
        },
        {
          provide: SheetsService,
          useValue: {},
        },
        {
          provide: UserService,
          useValue: {
            findByGoogleId: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(TimeEntryService);
  });

  it('returns the job state when the job belongs to the requesting user', async () => {
    queue.getJob.mockResolvedValue({
      data: { userId: 'google-123' },
      getState: jest.fn().mockResolvedValue('completed'),
    });

    await expect(
      service.getJobStatus('google-123', 'sheet-sync:job-1'),
    ).resolves.toEqual({
      jobId: 'sheet-sync:job-1',
      status: 'completed',
    });
  });

  it('hides jobs owned by another user', async () => {
    queue.getJob.mockResolvedValue({
      data: { userId: 'other-user' },
      getState: jest.fn(),
    });

    await expect(
      service.getJobStatus('google-123', 'sheet-sync:job-2'),
    ).resolves.toEqual({
      jobId: 'sheet-sync:job-2',
      status: 'not_found',
    });
  });
});
