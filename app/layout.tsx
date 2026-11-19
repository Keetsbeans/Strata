import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import RegisterSW from "@/components/RegisterSW";
import { THEME_SCRIPT } from "@/lib/theme";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Strata",
  description: "A private place for what you think, watch, read and hear.",
  manifest: `${base}/manifest.webmanifest`,
  icons: { icon: `${base}/icon.svg`, apple: `${base}/icon-192.png` },
  appleWebApp: { capable: true, title: "Strata", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#EFEDE8", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=Newsreader:ital,opsz,wght@0,6..72,400;1,6..72,400&display=swap"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
