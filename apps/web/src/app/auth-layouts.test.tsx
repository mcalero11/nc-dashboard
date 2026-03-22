import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redirectMock, cookiesMock, headersMock, getUserMock } = vi.hoisted(
  () => ({
    redirectMock: vi.fn((url: string) => {
      throw new Error(`REDIRECT:${url}`);
    }),
    cookiesMock: vi.fn(),
    headersMock: vi.fn(),
    getUserMock: vi.fn(),
  }),
);

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
  headers: headersMock,
}));

vi.mock('@/lib/auth', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/auth')>('@/lib/auth');
  return {
    ...actual,
    getUser: getUserMock,
  };
});

vi.mock('@/components/layout/dashboard-header', () => ({
  DashboardHeader: () => null,
}));

vi.mock('@/components/layout/setup-user-info', () => ({
  SetupUserInfo: () => null,
}));

import DashboardLayout from '@/app/(dashboard)/layout';
import SetupLayout from '@/app/setup/layout';

describe('protected layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects dashboard requests with expired sessions into the refresh flow', async () => {
    cookiesMock.mockResolvedValue({
      toString: () => 'jwt=session-token',
      get: () => ({ value: 'session-token' }),
    });
    headersMock.mockResolvedValue(
      new Headers({ 'x-current-path': '/dashboard' }),
    );
    getUserMock.mockResolvedValue(null);

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/api/auth/session?returnTo=%2Fdashboard',
    );
  });

  it('surfaces setup outages instead of redirecting users out of the app', async () => {
    cookiesMock.mockResolvedValue({
      toString: () => 'jwt=session-token',
      get: () => ({ value: 'session-token' }),
    });
    headersMock.mockResolvedValue(new Headers({ 'x-current-path': '/setup' }));
    getUserMock.mockRejectedValue(
      new Error('Unable to verify your session right now.'),
    );

    await expect(SetupLayout({ children: null })).rejects.toThrow(
      'Unable to verify your session right now.',
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
