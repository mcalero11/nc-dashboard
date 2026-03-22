import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './../src/health/health.module.js';

const redisPing = jest.fn();

jest.mock('ioredis', () =>
  jest.fn().mockImplementation(() => ({
    ping: redisPing,
  })),
);

describe('Health (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              REDIS_URL: 'redis://localhost:6379',
            }),
          ],
        }),
        HealthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/health returns 200', () => {
    redisPing.mockResolvedValue('PONG');

    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'ok' });
      });
  });

  it('GET /api/health returns 503 when Redis is down', () => {
    redisPing.mockRejectedValue(new Error('redis down'));

    return request(app.getHttpServer())
      .get('/api/health')
      .expect(503)
      .expect((res) => {
        expect(res.body).toMatchObject({ status: 'degraded' });
      });
  });
});
