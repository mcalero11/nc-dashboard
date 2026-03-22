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

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new HealthController({
      get: jest.fn().mockReturnValue('redis://localhost:6379'),
    } as unknown as ConfigService);
  });

  it('returns 200 with ok status when Redis responds', async () => {
    redisPing.mockResolvedValue('PONG');

    await expect(controller.check(res as Response)).resolves.toMatchObject({
      status: 'ok',
      redis: 'connected',
    });
    expect(res.status).not.toHaveBeenCalled();
  });

  it('returns 503 with degraded status when Redis is unavailable', async () => {
    redisPing.mockRejectedValue(new Error('redis down'));

    await expect(controller.check(res as Response)).resolves.toMatchObject({
      status: 'degraded',
      redis: 'disconnected',
    });
    expect(res.status).toHaveBeenCalledWith(503);
  });
});
