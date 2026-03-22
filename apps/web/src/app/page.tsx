import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser, UserLookupError } from '@/lib/auth';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; error?: string }>;
}) {
  const { expired, error } = await searchParams;

  const cookieStore = await cookies();
  const cookie = cookieStore.toString();
  let user = null;
  let sessionError = '';

  try {
    user = await getUser(cookie);
  } catch (caughtError) {
    if (caughtError instanceof UserLookupError) {
      sessionError = caughtError.message;
    } else {
      throw caughtError;
    }
  }

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-bold tracking-tight">NC Dashboard</h1>
        <p className="text-lg text-muted-foreground">
          Time tracking synced with Google Sheets
        </p>
      </div>

      {expired && (
        <p className="text-sm text-destructive">
          Your session has expired. Please sign in again.
        </p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {sessionError && (
        <p className="text-sm text-destructive">{sessionError}</p>
      )}

      <GoogleSignInButton />
    </div>
  );
}
