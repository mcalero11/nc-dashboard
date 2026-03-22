import { cookies } from 'next/headers';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionRefreshUrl, getUser } from '@/lib/auth';
import { DashboardHeader } from '@/components/layout/dashboard-header';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  const cookie = cookieStore.toString();
  const currentPath = headerStore.get('x-current-path') ?? '/dashboard';
  const hasJwt = Boolean(cookieStore.get('jwt')?.value);
  const user = await getUser(cookie);

  if (!user) {
    if (hasJwt) {
      redirect(getSessionRefreshUrl(currentPath));
    }
    redirect('/?expired=true');
  }

  if (!user.spreadsheetId) {
    redirect('/setup');
  }

  return (
    <div className="flex flex-1 flex-col">
      <DashboardHeader user={user} />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
