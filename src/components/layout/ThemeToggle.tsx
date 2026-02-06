"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useSession } from "next-auth/react";

const themes = [
  { value: "light", label: "Light" },
  { value: "midnight", label: "Midnight" },
  { value: "purple-rose", label: "Purple Rose" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const loadTheme = async () => {
      if (!session?.user?.id) return;
      try {
        const response = await fetch("/api/user/theme", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { theme?: string };
        if (data.theme) {
          setTheme(data.theme);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadTheme();
  }, [session?.user?.id, setTheme]);

  const handleThemeChange = async (value: string) => {
    setTheme(value);

    if (!session?.user?.id) return;

    setIsSyncing(true);

    try {
      await fetch("/api/user/theme", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme: value }),
      });
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
    <div className="panel p-4 flex flex-col gap-3">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
        Theme
      </p>
      <div className="flex flex-wrap gap-2">
        {themes.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => handleThemeChange(item.value)}
            className={`pill-button border text-xs cursor-pointer ${
              theme === item.value
                ? "border-transparent bg-[color:var(--accent)] text-white"
                : "border-slate-200 text-[color:var(--ink)]"
            }`}
          >
            {item.label}
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
