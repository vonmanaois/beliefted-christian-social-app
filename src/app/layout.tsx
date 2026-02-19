import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import { Inter } from "next/font/google";
import PWARegistration from "@/components/PWARegistration";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});


export const metadata: Metadata = {
  title: "Beliefted",
  description: "A Christian prayer wall and social journal.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/sheep.svg", type: "image/svg+xml" },
      { url: "/sheep-home-192.png", sizes: "192x192", type: "image/png" },
      { url: "/sheep-home-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/sheep-home-192.png",
    shortcut: "/sheep-home-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Beliefted",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#5CE1E6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isProduction = process.env.NODE_ENV === "production";
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-startup-image" href="/sheep-home-512.png" />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable}`}
      >
        <PWARegistration />
        <Providers>{children}</Providers>
        {isProduction && <Analytics />}
        {isProduction && <SpeedInsights />}
      </body>
    </html>
  );
}
