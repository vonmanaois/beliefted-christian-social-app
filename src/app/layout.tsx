import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/app/providers";

import "@fontsource/inter/variable.css";
import "@fontsource/dm-sans/variable.css";

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
      <body suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
