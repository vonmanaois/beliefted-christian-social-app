"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";

type ProvidersProps = {
  children: React.ReactNode;
};

export default function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      <ThemeProvider
        attribute="data-theme"
        defaultTheme="light"
        themes={["light", "midnight", "purple-rose"]}
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
