"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";

const tabs = ["Prayer Wall", "Word of the Day"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const router = useRouter();
  const pathname = usePathname();

  const activeTab = useMemo<Tab>(() => {
    if (pathname === "/wordoftheday" || pathname === "/word") {
      return "Word of the Day";
    }
    return "Prayer Wall";
  }, [pathname]);

  useEffect(() => {
    const handleOpenPrayer = () => {
      router.push("/");
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, [router]);

  useEffect(() => {
    const handleOpenWord = () => {
      router.push("/wordoftheday");
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [router]);

  return (
    <section className="flex flex-col gap-6 w-full">
      <div className="hidden md:flex items-center justify-center gap-4 w-full">
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="inline-flex items-center whitespace-nowrap rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)] cursor-pointer"
          >
            Sign in
          </button>
        ) : (
          <span className="w-20" />
        )}
        <div className="flex w-full max-w-2xl rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                router.push(tab === "Prayer Wall" ? "/" : "/wordoftheday");
              }}
              className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "rounded-lg bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                  : "rounded-lg text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="md:hidden w-full pt-2">
        <div className="grid w-full max-w-none grid-cols-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                router.push(tab === "Prayer Wall" ? "/" : "/wordoftheday");
              }}
              className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                activeTab === tab
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                  : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "Prayer Wall" ? <PrayerWall /> : <WordWall />}
    </section>
  );
}
