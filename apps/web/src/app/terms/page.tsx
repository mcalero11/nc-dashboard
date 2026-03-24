import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Terms of Service - NC Dashboard',
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Last updated: March 23, 2026
      </p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Service Description
          </h2>
          <p className="mt-2">
            NC Dashboard is a time tracking application that integrates with
            Google Sheets. It allows you to log, view, and manage time entries
            that are stored in your own Google Sheets spreadsheets.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            User Responsibilities
          </h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              You are responsible for maintaining the security of your Google
              account credentials.
            </li>
            <li>
              You agree to use the service only for lawful purposes and in
              accordance with these terms.
            </li>
            <li>
              You are responsible for the accuracy of the time entries you
              submit through the service.
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Data Ownership
          </h2>
          <p className="mt-2">
            All time tracking data entered through NC Dashboard is stored in
            your own Google Sheets spreadsheets. You retain full ownership of
            your data at all times. We do not claim any rights over the content
            you create or store through the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Service Availability
          </h2>
          <p className="mt-2">
            NC Dashboard is provided on an &quot;as is&quot; and &quot;as
            available&quot; basis. We do not guarantee uninterrupted or
            error-free operation. We reserve the right to modify, suspend, or
            discontinue the service at any time without prior notice.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Limitation of Liability
          </h2>
          <p className="mt-2">
            To the fullest extent permitted by law, NC Dashboard and its
            operator shall not be liable for any indirect, incidental, special,
            consequential, or punitive damages, including but not limited to
            loss of data, revenue, or profits, arising from your use of or
            inability to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">
            Modifications to Terms
          </h2>
          <p className="mt-2">
            We may update these terms from time to time. Continued use of the
            service after changes constitutes acceptance of the updated terms.
            We encourage you to review this page periodically.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p className="mt-2">
            If you have questions about these terms, contact us at{' '}
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
