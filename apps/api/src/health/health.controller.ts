import { Controller, Get, Res } from '@nestjs/common';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';

@Controller('health')
export class HealthController {
  private readonly redis: Redis;

  constructor(private readonly configService: ConfigService) {
    this.redis = new Redis(this.configService.get<string>('REDIS_URL')!);
  }

  @Get()
  async check(@Res({ passthrough: true }) res: Response) {
    let redisStatus = 'disconnected';
    try {
      const pong = await this.redis.ping();
      if (pong === 'PONG') redisStatus = 'connected';
    } catch {
      redisStatus = 'disconnected';
    }

    const isHealthy = redisStatus === 'connected';
    if (!isHealthy) {
      res.status(503);
    }

    return {
      status: isHealthy ? 'ok' : 'degraded',
      redis: redisStatus,
      uptime: process.uptime(),
    };
  }
}
