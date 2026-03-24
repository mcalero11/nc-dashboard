'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { API_PATHS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';
import { useUser } from '@/hooks/use-user';

export default function AuthorizedPage() {
  const router = useRouter();
  const { data: user } = useUser();

  async function handleLogout() {
    await apiFetch(API_PATHS.AUTH_LOGOUT, { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="w-full max-w-md space-y-6 text-center">
      <div className="space-y-2">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Authorization Successful
        </h1>
      </div>

      {user && (
        <div className="rounded-lg border bg-card p-4 text-left">
          <p className="text-sm font-medium">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
        </div>
      )}

      <p className="text-sm text-muted-foreground">
        Your account has been registered successfully. You can close this
        window.
      </p>

      <button
        onClick={handleLogout}
        className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </div>
  );
}
