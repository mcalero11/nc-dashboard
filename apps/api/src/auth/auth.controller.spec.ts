import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import type { Request, Response } from 'express';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            googleLogin: jest
              .fn()
              .mockResolvedValue({ jwt: 'mock-jwt', userType: 'internal' }),
            refreshSession: jest.fn().mockResolvedValue('new-mock-jwt'),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockImplementation((key: string) => {
              if (key === 'NODE_ENV') return 'development';
              if (key === 'JWT_EXPIRY') return 3600;
              if (key === 'SESSION_MAX_AGE') return 604800;
              if (key === 'FRONTEND_URL') return 'http://localhost:5173';
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('googleCallback', () => {
    it('should set JWT cookie and redirect to /dashboard', async () => {
      const req = {
        user: {
          googleId: 'g-123',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          accessToken: 'at',
          refreshToken: 'rt',
        },
      } as unknown as Request;

      const cookie = jest.fn();
      const redirect = jest.fn();
      const res = {
        cookie,
        redirect,
      } as unknown as Response;

      await controller.googleCallback(req, res);

      expect(authService.googleLogin.mock.calls).toEqual([[req.user]]);
      expect(cookie.mock.calls).toEqual([
        [
          'jwt',
          'mock-jwt',
          {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 604800000,
            path: '/',
          },
        ],
      ]);
      expect(redirect.mock.calls).toEqual([
        ['http://localhost:5173/dashboard'],
      ]);
    });

    it('should redirect external user to /authorized', async () => {
      authService.googleLogin.mockResolvedValueOnce({
        jwt: 'mock-jwt',
        userType: 'external',
      } as never);

      const req = {
        user: {
          googleId: 'g-456',
          email: 'external@gmail.com',
          firstName: 'External',
          lastName: 'User',
          accessToken: 'at',
          refreshToken: 'rt',
        },
      } as unknown as Request;

      const cookie = jest.fn();
      const redirect = jest.fn();
      const res = {
        cookie,
        redirect,
      } as unknown as Response;

      await controller.googleCallback(req, res);

      expect(cookie.mock.calls).toEqual([
        [
          'jwt',
          'mock-jwt',
          {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 604800000,
            path: '/',
          },
        ],
      ]);
      expect(redirect.mock.calls).toEqual([
        ['http://localhost:5173/authorized'],
      ]);
    });

    it('should redirect to frontend with error on authentication failure', async () => {
      authService.googleLogin.mockRejectedValueOnce(
        new Error('Authentication failed. Please try again.'),
      );

      const req = {
        user: {
          googleId: 'g-456',
          email: 'hacker@evil.com',
          firstName: 'Evil',
          lastName: 'User',
          accessToken: 'at',
          refreshToken: 'rt',
        },
      } as unknown as Request;

      const cookie = jest.fn();
      const redirect = jest.fn();
      const res = {
        cookie,
        redirect,
      } as unknown as Response;

      await controller.googleCallback(req, res);

      expect(cookie.mock.calls).toHaveLength(0);
      expect(redirect.mock.calls).toEqual([
        [
          `http://localhost:5173/?error=${encodeURIComponent('Authentication failed. Please try again.')}`,
        ],
      ]);
    });

    it('should return early when req.user is null (guard handled redirect)', async () => {
      const req = { user: null } as unknown as Request;
      const cookie = jest.fn();
      const redirect = jest.fn();
      const res = {
        cookie,
        redirect,
      } as unknown as Response;

      await controller.googleCallback(req, res);

      expect(authService.googleLogin.mock.calls).toHaveLength(0);
      expect(cookie.mock.calls).toHaveLength(0);
      expect(redirect.mock.calls).toHaveLength(0);
    });
  });

  describe('logout', () => {
    it('should clear cookie and return success', () => {
      const clearCookie = jest.fn();
      const json = jest.fn();
      const res = {
        clearCookie,
        json,
      } as unknown as Response;

      controller.logout(res);

      expect(clearCookie.mock.calls).toEqual([
        ['jwt', { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }],
      ]);
      expect(json.mock.calls).toEqual([[{ message: 'Logged out' }]]);
    });
  });

  describe('refresh', () => {
    it('should return 401 when no cookie is present', async () => {
      const req = { cookies: {} } as unknown as Request;
      const cookie = jest.fn();
      const clearCookie = jest.fn();
      const json = jest.fn();
      const res = {
        cookie,
        clearCookie,
        json,
      } as unknown as Response;

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should set new cookie and return success on valid refresh', async () => {
      const req = { cookies: { jwt: 'expired-jwt' } } as unknown as Request;
      const cookie = jest.fn();
      const clearCookie = jest.fn();
      const json = jest.fn();
      const res = {
        cookie,
        clearCookie,
        json,
      } as unknown as Response;

      await controller.refresh(req, res);

      expect(authService.refreshSession.mock.calls).toEqual([['expired-jwt']]);
      expect(cookie.mock.calls).toEqual([
        [
          'jwt',
          'new-mock-jwt',
          {
            httpOnly: true,
            secure: false,
            sameSite: 'lax',
            maxAge: 604800000,
            path: '/',
          },
        ],
      ]);
      expect(json.mock.calls).toEqual([[{ message: 'Token refreshed' }]]);
    });

    it('should clear cookie and throw 401 on refresh failure', async () => {
      authService.refreshSession.mockRejectedValueOnce(
        new UnauthorizedException('Session expired'),
      );
      const req = { cookies: { jwt: 'expired-jwt' } } as unknown as Request;
      const cookie = jest.fn();
      const clearCookie = jest.fn();
      const json = jest.fn();
      const res = {
        cookie,
        clearCookie,
        json,
      } as unknown as Response;

      await expect(controller.refresh(req, res)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(clearCookie.mock.calls).toEqual([
        ['jwt', { httpOnly: true, secure: false, sameSite: 'lax', path: '/' }],
      ]);
    });
  });

  describe('me', () => {
    it('should return JWT payload from request', () => {
      const payload = {
        sub: 'g-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        spreadsheetId: null,
      };
      const req = { user: payload } as unknown as Request;

      const result = controller.me(req);

      expect(result).toEqual(payload);
    });
  });
});
