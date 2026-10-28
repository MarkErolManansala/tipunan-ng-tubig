/**
 * Decorative topographic contour field (DESIGN.md §Topographic identity).
 * Hand-authored bezier "contour lines" rendered on the navy hero band.
 * Purely decorative — aria-hidden, deterministic (no randomness), and it
 * never carries information. Reduced-motion irrelevant (no animation).
 */
export function ContourField({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      className={className}
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
    >
      <path
        d="M-40 340 C 140 300, 260 356, 420 330 S 700 260, 880 300 S 1120 340, 1240 308"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.16"
      />
      <path
        d="M-40 306 C 130 268, 270 322, 430 296 S 710 226, 890 264 S 1130 304, 1240 274"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.12"
      />
      <path
        d="M-40 272 C 120 236, 280 288, 440 262 S 720 192, 900 228 S 1140 268, 1240 240"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.09"
      />
      <path
        d="M-40 238 C 110 204, 290 254, 450 228 S 730 158, 910 192 S 1150 232, 1240 206"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.06"
      />
      <path
        d="M-60 420 C 60 372, 200 396, 330 362 C 430 336, 470 300, 560 290 C 640 282, 690 310, 780 330 C 900 356, 1040 372, 1240 358"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.1"
      />
      <path
        d="M-60 388 C 70 342, 210 364, 340 332 C 440 308, 480 274, 570 262 C 650 252, 700 280, 790 300 C 910 326, 1050 340, 1240 326"
        stroke="currentColor"
        strokeWidth="1.5"
        opacity="0.07"
      />
      <circle cx="205" cy="318" r="2" fill="currentColor" opacity="0.35" />
      <circle cx="612" cy="279" r="2" fill="currentColor" opacity="0.28" />
      <circle cx="894" cy="296" r="2" fill="currentColor" opacity="0.3" />
    </svg>
  );
}
