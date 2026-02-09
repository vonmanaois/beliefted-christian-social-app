import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/providers";
import { Inter, DM_Sans } from "next/font/google";

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
  icons: {
    icon: "/images/beliefted-logo.svg",
    apple: "/images/beliefted-logo.svg",
    shortcut: "/images/beliefted-logo.svg",
  },
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
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
