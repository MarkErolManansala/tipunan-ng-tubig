import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const metadata: Metadata = {
  title: "Credits",
  description:
    "Credits and acknowledgments for Tipunan ng Tubig, including the Tubig API by RJ Hon.",
};

/**
 * Credits page: acknowledges the Tubig API creator and data sources.
 * Follows DESIGN.md: navy chrome, mist canvas, water-blue links, mono for URLs.
 */
export default function CreditsPage() {
  return (
    <main className="flex-1">
      <div className="mx-auto w-full max-w-6xl px-6 pt-8 pb-16">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-water-600 transition-colors hover:text-water-500 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to home
        </Link>

        <h1 className="mt-6 text-3xl font-semibold tracking-tight text-ink md:text-4xl">
          Credits
        </h1>

        <div className="mt-8 space-y-8">
          {/* Tubig API Creator */}
          <section
            aria-labelledby="creator-heading"
            className="rounded-lg border border-hairline bg-card p-6"
          >
            <h2
              id="creator-heading"
              className="text-xl font-semibold tracking-tight text-ink"
            >
              Tubig API
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-body">
              This application is powered by the{" "}
              <a
                href="https://tubig-api.rjhon.net/"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-water-600 underline-offset-4 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Tubig API
                <ExternalLink
                  className="ml-1 inline size-3.5"
                  aria-hidden="true"
                />
              </a>
              , a public JSON API created by{" "}
              <a
                href="https://rjhon.net/about"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-water-600 underline-offset-4 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                RJ Hon
                <ExternalLink
                  className="ml-1 inline size-3.5"
                  aria-hidden="true"
                />
              </a>
              . The Tubig API aggregates water and weather risk data for Metro
              Manila, including Maynilad advisories, PAGASA dam levels, river
              gauges, typhoon bulletins, and drought outlooks.
            </p>

            <div className="mt-4 space-y-2">
              <div>
                <p className="text-xs font-semibold tracking-wide uppercase text-ink-meta">
                  Project
                </p>
                <p className="mt-1 text-sm text-ink-body">
                  A side project during the El Niño scare, providing water and
                  weather risk tracking for Metro Manila with historical data
                  and AI-powered briefings.
                </p>
              </div>

              <div className="mt-3">
                <p className="text-xs font-semibold tracking-wide uppercase text-ink-meta">
                  Resources
                </p>
                <ul className="mt-2 space-y-1.5 text-sm">
                  <li>
                    <a
                      href="https://tubig.rjhon.net/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-water-600 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      tubig.rjhon.net
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="font-sans text-ink-meta">
                        — Main application
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tubig-api.rjhon.net/history"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-water-600 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      tubig-api.rjhon.net/history
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="font-sans text-ink-meta">
                        — Historical data
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tubig-api.rjhon.net/history/api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-water-600 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      tubig-api.rjhon.net/history/api
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="font-sans text-ink-meta">
                        — API documentation
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://tubig.rjhon.net/research"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-water-600 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      tubig.rjhon.net/research
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="font-sans text-ink-meta">
                        — White paper
                      </span>
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://github.com/yourjhay"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 font-mono text-water-600 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      github.com/yourjhay
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      <span className="font-sans text-ink-meta">
                        — GitHub profile
                      </span>
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          {/* Data Sources */}
          <section
            aria-labelledby="sources-heading"
            className="rounded-lg border border-hairline bg-card p-6"
          >
            <h2
              id="sources-heading"
              className="text-xl font-semibold tracking-tight text-ink"
            >
              Data sources
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-body">
              All dam water levels, thresholds, and rule curves are sourced from
              PAGASA (Philippine Atmospheric, Geophysical and Astronomical
              Services Administration) observations via the Tubig API. This
              application does not create or modify any readings — it presents
              the upstream data as-is.
            </p>
            <p className="mt-3 text-sm leading-6 text-ink-body">
              Status classifications (Normal, Watch, Warning, Critical, Low) are
              computed by this application from each dam&apos;s published
              numeric thresholds and are not official operational declarations.
            </p>
          </section>

          {/* Development */}
          <section
            aria-labelledby="development-heading"
            className="rounded-lg border border-hairline bg-card p-6"
          >
            <h2
              id="development-heading"
              className="text-xl font-semibold tracking-tight text-ink"
            >
              Development
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-body">
              This application (Tipunan ng Tubig) was developed by{" "}
              <a
                href="https://github.com/MarkErolManansala"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-water-600 underline-offset-4 transition-colors hover:text-water-500 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Mark Erol Manansala
                <ExternalLink
                  className="ml-1 inline size-3.5"
                  aria-hidden="true"
                />
              </a>
              .
            </p>
          </section>

          {/* License & Usage */}
          <section
            aria-labelledby="license-heading"
            className="rounded-lg border border-hairline bg-card p-6"
          >
            <h2
              id="license-heading"
              className="text-xl font-semibold tracking-tight text-ink"
            >
              Usage
            </h2>
            <p className="mt-3 text-sm leading-6 text-ink-body">
              The Tubig API is a free, rate-limited public API for developers.
              Not affiliated with or endorsed by PAGASA, Maynilad, or Manila
              Water. All data is provided as-is for informational purposes.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
