import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionRefreshUrl, getUser } from '@/lib/auth';
import { SetupUserInfo } from '@/components/layout/setup-user-info';

export default async function SetupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookie = cookieStore.toString();
  const currentPath = headerStore.get('x-current-path') ?? '/setup';
  const hasJwt = Boolean(cookieStore.get('jwt')?.value);
  const user = await getUser(cookie);

  if (!user) {
    if (hasJwt) {
      redirect(getSessionRefreshUrl(currentPath));
    }
    redirect('/?expired=true');
  }

  return (
    <div className="min-h-screen">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <h1 className="text-lg font-semibold">NC Dashboard</h1>
          <SetupUserInfo user={user} />
        </div>
      </header>
      <div className="flex flex-col items-center justify-center p-4 pt-12">
        {children}
      </div>
    </div>
  );
}
