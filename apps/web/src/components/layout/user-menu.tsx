'use client';

import type { JwtPayload } from '@nc-dashboard/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileSpreadsheet, LogOut, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { API_PATHS } from '@/lib/constants';
import { apiFetch } from '@/lib/api';

interface UserMenuProps {
  user: JwtPayload;
}

export function UserMenu({ user }: UserMenuProps) {
  const router = useRouter();

  async function handleLogout() {
    await apiFetch(API_PATHS.AUTH_LOGOUT, { method: 'POST' });
    router.push('/');
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium hover:bg-muted outline-none">
        <User className="h-4 w-4" />
        <span className="hidden sm:inline">{user.firstName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            {user.firstName} {user.lastName}
            <p className="text-xs font-normal text-muted-foreground">
              {user.email}
            </p>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => router.push('/setup?from=dashboard')}>
          <FileSpreadsheet className="mr-2 h-4 w-4" />
          Sheet Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
