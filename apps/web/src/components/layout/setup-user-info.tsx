'use client';

import type { JwtPayload } from '@nc-dashboard/shared';
import { LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_PATHS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';

interface SetupUserInfoProps {
  user: JwtPayload;
}

export function SetupUserInfo({ user }: SetupUserInfoProps) {
  const router = useRouter();

  async function handleLogout() {
    await apiFetch(API_PATHS.AUTH_LOGOUT, { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <p className="text-sm font-medium leading-tight">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-muted-foreground">{user.email}</p>
      </div>
      <button
        onClick={handleLogout}
        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}
