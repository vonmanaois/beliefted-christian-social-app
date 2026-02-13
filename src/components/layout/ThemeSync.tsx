"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";

export default function ThemeSync() {
  const { data: session } = useSession();
  const { theme, setTheme } = useTheme();
  const hasFetched = useRef(false);

  useEffect(() => {
    if (!session?.user?.id) {
      hasFetched.current = false;
      return;
    }
    if (hasFetched.current) return;
    if (typeof window === "undefined") return;

    const loadTheme = async () => {
      try {
        const response = await fetch("/api/user/theme", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { theme?: string };
        if (!data.theme || data.theme === theme) {
          hasFetched.current = true;
          return;
        }
        setTheme(data.theme);
        window.localStorage.setItem("beliefted_theme", data.theme);
        hasFetched.current = true;
      } catch {
        // ignore theme sync errors
      }
    };

    loadTheme();
  }, [session?.user?.id, setTheme, theme]);

  return null;
}
