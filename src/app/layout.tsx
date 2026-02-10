import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import { Inter, DM_Sans } from "next/font/google";
import PWARegistration from "@/components/PWARegistration";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Beliefted",
  description: "A Christian prayer wall and social journal.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/icon-192.png",
    shortcut: "/icon-192.png",
  },
  appleWebApp: {
    capable: true,
    title: "Beliefted",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#3aa0f6",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${dmSans.variable}`}
      >
        <PWARegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
