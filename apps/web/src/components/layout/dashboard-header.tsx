import type { JwtPayload } from '@nc-dashboard/shared';
import { SheetConnectionStatus } from './sheet-connection-status';
import { UserMenu } from './user-menu';

import { Logo } from './logo';

interface DashboardHeaderProps {
  user: JwtPayload;
}

export function DashboardHeader({ user }: DashboardHeaderProps) {
  return (
    <header className="border-b bg-background">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo className="h-8 w-auto" />
        <div className="flex items-center gap-3">
          <SheetConnectionStatus />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
