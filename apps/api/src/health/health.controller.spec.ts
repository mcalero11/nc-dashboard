import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { HealthController } from './health.controller.js';

const redisPing = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    ping: redisPing,
  })),
);

describe('HealthController', () => {
  let controller: HealthController;
  const res: Pick<Response, 'status'> = {
    status: jest.fn(),
  };

  function makeConfigService(weeksBehind?: number) {
    return {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'REDIS_URL') return 'redis://localhost:6379';
        if (key === 'OPS_SYNC_WEEKS_BEHIND') return weeksBehind;
        return undefined;
      }),
    } as unknown as ConfigService;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController(makeConfigService(4));
  });

  it('returns 200 with ok status when Redis responds', async () => {
    redisPing.mockResolvedValue('PONG');

    await expect(controller.check(res as Response)).resolves.toMatchObject({
      status: 'ok',
      redis: 'connected',
      weeksBehind: 4,
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 with degraded status when Redis is unavailable', async () => {
    redisPing.mockRejectedValue(new Error('redis down'));

    await expect(controller.check(res as Response)).resolves.toMatchObject({
      status: 'degraded',
      redis: 'disconnected',
      weeksBehind: 4,
    });
    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('defaults weeksBehind to 0 when OPS_SYNC_WEEKS_BEHIND is not set', async () => {
    controller = new HealthController(makeConfigService(undefined));
    redisPing.mockResolvedValue('PONG');

    await expect(controller.check(res as Response)).resolves.toMatchObject({
      weeksBehind: 0,
    });
  });
});
