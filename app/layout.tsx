import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";
import { cn } from "@/lib/utils";

/*
 * Typeface (DESIGN.md): Geist Sans carries the UI, Geist Mono carries every
 * measurement (tabular figures keep columns of metres aligned). Both load via
 * next/font with CSS variables consumed by the @theme tokens in globals.css.
 */
const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Tipunan ng Tubig",
    template: "%s · Tipunan ng Tubig",
  },
  description:
    "Daily water levels and published thresholds for Philippine dams, sourced from the Tubig API (PAGASA dam observations).",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
      )}
    >
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
