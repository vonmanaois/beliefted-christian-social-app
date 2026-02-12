"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";

const themes = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "midnight", label: "Midnight" },
  { value: "purple-rose", label: "Purple Rose" },
  { value: "banana", label: "Banana" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastRequestedTheme = useRef<string | null>(null);
  const hasFetched = useRef(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) {
        return parts.pop()?.split(";").shift() ?? null;
      }
      return null;
    };
    const localTheme = window.localStorage.getItem("beliefted_theme");
    const cookieTheme = getCookie("beliefted_theme");
    const storedTheme = localTheme || cookieTheme;
    if (storedTheme && storedTheme !== theme) {
      setTheme(storedTheme);
    }
  }, [mounted, setTheme, theme]);

  useEffect(() => {
    const loadTheme = async () => {
      if (!session?.user?.id || hasFetched.current) return;
      const localTheme = window.localStorage.getItem("beliefted_theme");
      const cookieTheme = document.cookie
        .split("; ")
        .find((row) => row.startsWith("beliefted_theme="))
        ?.split("=")[1];
      if (localTheme || cookieTheme) return;
      try {
        const response = await fetch("/api/user/theme", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { theme?: string };
        if (!data.theme || data.theme === theme) return;
        if (lastRequestedTheme.current && data.theme !== lastRequestedTheme.current) {
          return;
        }
        setTheme(data.theme);
        lastRequestedTheme.current = null;
        window.localStorage.setItem("beliefted_theme", data.theme);
        hasFetched.current = true;
      } catch (error) {
        console.error(error);
      }
    };

    loadTheme();
  }, [session?.user?.id, setTheme, theme]);

  const handleThemeChange = async (value: string) => {
    lastRequestedTheme.current = value;
    setTheme(value);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("beliefted_theme", value);
      document.cookie = `beliefted_theme=${value}; path=/; max-age=${60 * 60 * 24 * 365}`;
    }

    if (!session?.user?.id) return;

    setIsSyncing(true);

    try {
      await fetch("/api/user/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
      lastRequestedTheme.current = null;
    } catch (error) {
      console.error(error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        {themes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleThemeChange(item.value)}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm cursor-pointer ${
              theme === item.value
                ? "border-transparent bg-[color:var(--accent)] text-[color:var(--accent-contrast)] hover:text-[color:var(--accent-contrast)]"
                : "border-[color:var(--panel-border)] text-[color:var(--ink)] hover:border-[color:var(--accent)] hover:text-[color:var(--ink)]"
            }`}
          >
            <span
              className={`relative z-10 font-semibold ${
                theme === item.value
                  ? "text-[color:var(--accent-contrast)]"
                  : "text-[color:var(--ink)]"
              }`}
            >
              {item.label}
            </span>
            <span
              className={`relative inline-flex h-5 w-10 items-center rounded-full ${
                theme === item.value ? "bg-white/30" : "bg-[color:var(--surface-strong)]"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full ${
                  theme === item.value
                    ? "translate-x-5 bg-white"
                    : "translate-x-1 bg-[color:var(--panel)]"
                }`}
              />
            </span>
          </button>
        ))}
      </div>
      {session?.user?.id && (
        <p className="text-xs text-[color:var(--subtle)]">
          {isSyncing ? "Saving theme..." : "Saved to your account."}
        </p>
      )}
    </div>
  );
}
