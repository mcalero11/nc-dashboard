import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy - NC Dashboard',
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 23, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            What Data We Collect
          </h2>
          <p className="mt-2">
            When you sign in with Google, we receive your name and email address
            from your Google account. This information is used solely to
            identify your account within NC Dashboard.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Google Sheets Access
          </h2>
          <p className="mt-2">
            NC Dashboard requests read and write access to Google Sheets that
            you select for time tracking. We only interact with spreadsheets you
            explicitly choose — we never access other files in your Google
            account.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Google Drive Metadata Access
          </h2>
          <p className="mt-2">
            We request access to Google Drive file metadata (file names, IDs,
            and modification dates) to help you find and select your timesheet
            spreadsheets. We do not read or access the content of any files
            through this permission.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            How Data Is Stored
          </h2>
          <p className="mt-2">
            Your session is managed through secure, server-side JWT tokens.
            Google OAuth tokens are encrypted and stored server-side. We do not
            store your Google password.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Data Retention and Deletion
          </h2>
          <p className="mt-2">
            Your data is retained only while your account is active. You can
            revoke NC Dashboard&apos;s access to your Google account at any time
            through your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>
            . Upon revocation, your stored tokens are invalidated and your
            session data is removed.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Google API Services User Data Policy
          </h2>
          <p className="mt-2">
            NC Dashboard&apos;s use and transfer of information received from
            Google APIs adheres to the{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              className="text-foreground underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google API Services User Data Policy
            </a>
            , including the Limited Use requirements. Specifically:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              We only use Google user data to provide and improve the time
              tracking features you see in the app.
            </li>
            <li>
              We do not transfer Google user data to third parties except as
              necessary to provide the service, comply with applicable laws, or
              as part of a merger/acquisition with adequate data protection.
            </li>
            <li>We do not use Google user data for serving advertisements.</li>
            <li>
              We do not allow humans to read Google user data unless we have
              your affirmative consent, it is necessary for security purposes,
              or it is required by law.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            If you have questions about this privacy policy, contact us at{' '}
            <a
              href="mailto:hello@mcalero.dev"
              className="text-foreground underline"
            >
              hello@mcalero.dev
            </a>
            .
          </p>
        </section>
      </div>

      <div className="mt-12">
        <Link
          href="/"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
