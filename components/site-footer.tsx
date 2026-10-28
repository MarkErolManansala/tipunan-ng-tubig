import Link from "next/link";

/**
 * The footer (DESIGN.md §Navigation/Footer): navy band with the data
 * attribution, the sync schedule, and the status-derivation disclosure that
 * keeps every computed tier honest. Also includes a credit link to the Tubig
 * API creator.
 */
export function SiteFooter() {
  return (
    <footer className="mt-16 bg-navy-950">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-6 py-10 md:grid-cols-4">
        <div>
          <p className="text-sm font-semibold text-white">Tipunan ng Tubig</p>
          <p className="mt-2 text-xs leading-5 text-navy-300">
            Water levels and published thresholds for Philippine dams.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-navy-300 uppercase">
            Data
          </p>
          <p className="mt-2 text-xs leading-5 text-navy-300">
            Sourced from the Tubig API (PAGASA dam observations) and refreshed
            daily around 11:00 PHT. A dash means a value is unknown (never
            zero). Timestamps render in PHT.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-navy-300 uppercase">
            About monitoring status
          </p>
          <p className="mt-2 text-xs leading-5 text-navy-300">
            Status chips (Normal, Watch, Warning, Critical, Low) are computed
            by this application from each dam&apos;s published numeric
            thresholds (not an official operational declaration). Dams without
            numeric thresholds are shown as &ldquo;Not classified&rdquo;.
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-navy-300 uppercase">
            Credits
          </p>
          <p className="mt-2 text-xs leading-5 text-navy-300">
            Powered by the{" "}
            <a
              href="https://tubig-api.rjhon.net/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline-offset-2 transition-colors hover:text-water-300 hover:underline focus-visible:ring-2 focus-visible:ring-water-300 focus-visible:outline-none"
            >
              Tubig API
            </a>{" "}
            created by{" "}
            <a
              href="https://rjhon.net/about"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-white underline-offset-2 transition-colors hover:text-water-300 hover:underline focus-visible:ring-2 focus-visible:ring-water-300 focus-visible:outline-none"
            >
              RJ Hon
            </a>
            .{" "}
            <Link
              href="/credits"
              className="font-medium text-white underline-offset-2 transition-colors hover:text-water-300 hover:underline focus-visible:ring-2 focus-visible:ring-water-300 focus-visible:outline-none"
            >
              Learn more
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}
