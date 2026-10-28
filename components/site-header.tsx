import Link from "next/link";
import { Droplets } from "lucide-react";

/**
 * The global navigation bar (DESIGN.md §Navigation): deep navy chrome,
 * 64px tall, full-bleed, wordmark left, section link right. Shared layout
 * between all pages so governance of the identity lives in one component.
 */
export function SiteHeader() {
  return (
    <header className="bg-navy-900">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-white focus-visible:ring-2 focus-visible:ring-water-300 focus-visible:outline-none focus-visible:ring-offset-2 focus-visible:ring-offset-navy-900 rounded-sm"
        >
          <Droplets className="size-5 text-water-300" aria-hidden />
          <span className="flex flex-col leading-none">
            <span className="text-[15px] font-semibold tracking-tight">
              Tipunan ng Tubig
            </span>
            <span className="mt-1 text-[11px] font-normal text-navy-300">
              Philippine reservoir intelligence
            </span>
          </span>
        </Link>
        <nav aria-label="Main" className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-white/80 transition-colors hover:text-white"
          >
            All dams
          </Link>
        </nav>
      </div>
    </header>
  );
}
