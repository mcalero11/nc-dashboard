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

vi.mock('@/components/layout/logo', () => ({
  Logo: () => null,
}));

import DashboardLayout from '@/app/(dashboard)/layout';
import SetupLayout from '@/app/setup/layout';
import AuthorizedLayout from '@/app/authorized/layout';

function mockAuthenticated(path: string) {
  cookiesMock.mockResolvedValue({
    toString: () => 'jwt=session-token',
    get: () => ({ value: 'session-token' }),
  });
  headersMock.mockResolvedValue(new Headers({ 'x-current-path': path }));
}

const internalUser = {
  sub: 'g-1',
  email: 'dev@example.com',
  firstName: 'Dev',
  lastName: 'User',
  spreadsheetId: 'sheet-1',
  sessionStart: 1700000000,
  userType: 'internal' as const,
};

const externalUser = {
  sub: 'g-2',
  email: 'tester@gmail.com',
  firstName: 'Tester',
  lastName: 'User',
  spreadsheetId: null,
  sessionStart: 1700000000,
  userType: 'external' as const,
};

describe('protected layouts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects dashboard requests with expired sessions into the refresh flow', async () => {
    mockAuthenticated('/dashboard');
    getUserMock.mockResolvedValue(null);

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/api/auth/session?returnTo=%2Fdashboard',
    );
  });

  it('surfaces setup outages instead of redirecting users out of the app', async () => {
    mockAuthenticated('/setup');
    getUserMock.mockRejectedValue(
      new Error('Unable to verify your session right now.'),
    );

    await expect(SetupLayout({ children: null })).rejects.toThrow(
      'Unable to verify your session right now.',
    );
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

describe('external user redirects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redirects external users from dashboard to /authorized', async () => {
    mockAuthenticated('/dashboard');
    getUserMock.mockResolvedValue(externalUser);

    await expect(DashboardLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/authorized',
    );
  });

  it('redirects external users from setup to /authorized', async () => {
    mockAuthenticated('/setup');
    getUserMock.mockResolvedValue(externalUser);

    await expect(SetupLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/authorized',
    );
  });

  it('redirects internal users from /authorized to /dashboard', async () => {
    mockAuthenticated('/authorized');
    getUserMock.mockResolvedValue(internalUser);

    await expect(AuthorizedLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/dashboard',
    );
  });

  it('redirects unauthenticated users from /authorized to /', async () => {
    cookiesMock.mockResolvedValue({
      toString: () => '',
      get: () => undefined,
    });
    headersMock.mockResolvedValue(
      new Headers({ 'x-current-path': '/authorized' }),
    );
    getUserMock.mockResolvedValue(null);

    await expect(AuthorizedLayout({ children: null })).rejects.toThrow(
      'REDIRECT:/',
    );
  });

  it('renders authorized layout for external users', async () => {
    mockAuthenticated('/authorized');
    getUserMock.mockResolvedValue(externalUser);

    const result = await AuthorizedLayout({ children: 'test-content' });

    expect(redirectMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
