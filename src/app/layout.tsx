import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import { Inter } from "next/font/google";
import PWARegistration from "@/components/PWARegistration";

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
  themeColor: "#f3f4f6",
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
        className={`${inter.variable}`}
        style={{ backgroundColor: "#f3f4f6" }}
      >
        <PWARegistration />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
