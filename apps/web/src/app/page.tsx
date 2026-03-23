import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUser, UserLookupError } from '@/lib/auth';
import Link from 'next/link';
import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { Logo } from '@/components/layout/logo';

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
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo className="h-16 w-auto" />
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

      <footer className="mt-auto pb-6 pt-12 text-center text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          Privacy Policy
        </Link>
        <span className="mx-2">·</span>
        <Link href="/terms" className="hover:underline">
          Terms of Service
        </Link>
      </footer>
    </div>
  );
}
