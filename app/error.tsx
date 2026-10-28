"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

/**
 * Route-level error boundary. Unexpected failures land here; internal error
 * details are never rendered (security rules).
 */
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-card p-10 text-center">
        <TriangleAlert className="mx-auto size-8 text-amber-700" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm leading-6 text-ink-body">
          Dam data could not be loaded right now. The upstream source or the
          database may be temporarily unavailable — no partial or placeholder
          values are shown while it is down.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Try again
          </button>
          <Link
            href="/"
            className="text-sm font-medium text-water-600 underline-offset-4 hover:underline"
          >
            Back to all dams
          </Link>
        </div>
      </div>
    </main>
  );
}
