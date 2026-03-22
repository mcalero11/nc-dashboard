import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getUser, UserLookupError } from './auth';

describe('getUser', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for an expired or missing session', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 401,
        ok: false,
      }),
    );

    await expect(getUser('jwt=test')).resolves.toBeNull();
  });

  it('throws a UserLookupError for upstream failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 503,
        ok: false,
      }),
    );

    await expect(getUser('jwt=test')).rejects.toBeInstanceOf(UserLookupError);
  });

  it('throws a UserLookupError for network failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    await expect(getUser('jwt=test')).rejects.toBeInstanceOf(UserLookupError);
  });
});
