import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { JwtService } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import cookieParser from 'cookie-parser';
import { AuthModule } from '../src/auth/auth.module.js';
import { ConfigModule } from '@nestjs/config';
import { User } from '../src/user/user.entity.js';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [
            () => ({
              JWT_SECRET: 'test-jwt-secret-for-e2e',
              JWT_EXPIRY: 3600,
              FRONTEND_URL: 'http://localhost:5173',
              GOOGLE_CLIENT_ID: 'test-client-id',
              GOOGLE_CLIENT_SECRET: 'test-client-secret',
              GOOGLE_CALLBACK_URL:
                'http://localhost:3000/api/auth/google/callback',
              TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
              NODE_ENV: 'test',
              SESSION_MAX_AGE: 604800,
            }),
          ],
        }),
        TypeOrmModule.forRoot({
          type: 'better-sqlite3',
          database: ':memory:',
          entities: [User],
          synchronize: true,
        }),
        AuthModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.use(cookieParser());
    await app.init();

    jwtService = moduleFixture.get(JwtService);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/auth/google', () => {
    it('should redirect to Google OAuth', () => {
      return request(app.getHttpServer())
        .get('/api/auth/google')
        .expect(302)
        .expect((res) => {
          expect(res.headers.location).toContain('accounts.google.com');
        });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without JWT', () => {
      return request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return user payload with valid JWT', () => {
      const payload = {
        sub: 'g-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        spreadsheetId: null,
      };
      const token = jwtService.sign(payload);

      return request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Cookie', `jwt=${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toMatchObject({
            sub: 'g-123',
            email: 'test@example.com',
          });
        });
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should return 401 without JWT', () => {
      return request(app.getHttpServer()).post('/api/auth/logout').expect(401);
    });

    it('should clear cookie and return 200 with valid JWT', () => {
      const token = jwtService.sign({
        sub: 'g-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        spreadsheetId: null,
      });

      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Cookie', `jwt=${token}`)
        .expect(201)
        .expect((res) => {
          expect(res.body).toMatchObject({ message: 'Logged out' });
          const cookies = res.headers['set-cookie'];
          expect(cookies).toBeDefined();
          const cookieStr = Array.isArray(cookies)
            ? cookies.join('; ')
            : cookies;
          expect(cookieStr).toContain('jwt=;');
        });
    });
  });
});
