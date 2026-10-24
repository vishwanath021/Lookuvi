import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import { TapFeel } from "@/components/brand/TapFeel";
import "./globals.css";

// Files live in the repo so the production image does not call Google Fonts at build time.
const sans = localFont({
  src: [
    { path: "../fonts/inter-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/inter-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/inter-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/inter-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-sans",
  display: "swap",
});
const display = localFont({
  src: [{ path: "../fonts/cormorant-600.woff2", weight: "600", style: "normal" }],
  variable: "--font-display",
  display: "swap",
});
const deva = localFont({
  src: [
    { path: "../fonts/deva-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/deva-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-deva",
  display: "swap",
  preload: false,
});
const knda = localFont({
  src: [
    { path: "../fonts/knda-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/knda-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-knda",
  display: "swap",
  preload: false,
});
const taml = localFont({
  src: [
    { path: "../fonts/taml-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/taml-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-taml",
  display: "swap",
  preload: false,
});
const telu = localFont({
  src: [
    { path: "../fonts/telu-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/telu-600.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-telu",
  display: "swap",
  preload: false,
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  applicationName: "Lookuvi",
  title: "Lookuvi",
  description: "See your next look.",
  icons: { icon: "/brand/lookuvi-app-icon.png", apple: "/brand/lookuvi-app-icon.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading the request headers opts the document into dynamic rendering.
  // Next then copies the nonce from the request Content-Security-Policy onto its script tags.
  // The nonce is not placed on <html>: that mismatched during hydration and lit the dev error badge.
  void (await headers()).get("x-nonce");
  return (
    <html lang="en">
      <body className={`${sans.className} ${sans.variable} ${display.variable} ${deva.variable} ${knda.variable} ${taml.variable} ${telu.variable}`}>
        <TapFeel />
        <a className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:bg-white focus:px-3 focus:py-2" href="#main">Skip to content</a>
        <div id="main">{children}</div>
      </body>
    </html>
  );
}
