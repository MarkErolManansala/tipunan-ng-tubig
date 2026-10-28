import Link from "next/link";
import { SearchX } from "lucide-react";

/** Rendered when a dam id does not exist (DESIGN.md empty-state pattern). */
export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="w-full max-w-md rounded-xl border border-hairline bg-card p-10 text-center">
        <SearchX className="mx-auto size-8 text-ink-faint" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold text-ink">Dam not found</h1>
        <p className="mt-2 text-sm leading-6 text-ink-body">
          The dam you are looking for does not exist or has no recorded data.
        </p>
        <p className="mt-6">
          <Link
            href="/"
            className="text-sm font-medium text-water-600 underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Back to all dams
          </Link>
        </p>
      </div>
    </main>
  );
}
