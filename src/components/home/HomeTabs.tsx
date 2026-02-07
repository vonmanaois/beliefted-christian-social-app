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

  return (
    <section className="flex flex-col gap-6">
      <div className="hidden md:flex items-center justify-between">
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="inline-flex items-center rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)] cursor-pointer"
          >
            Sign in
          </button>
        ) : (
          <span />
        )}
        <div className="inline-flex rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                router.push(tab === "Prayer Wall" ? "/" : "/wordoftheday");
              }}
              className={`px-4 py-2 text-sm font-semibold transition ${
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

      <div className="md:hidden flex items-center justify-end">
        <button
          type="button"
          onClick={() => {
            const next = activeTab === "Prayer Wall" ? "Word of the Day" : "Prayer Wall";
            router.push(next === "Prayer Wall" ? "/" : "/wordoftheday");
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] transition hover:text-[color:var(--accent)]"
        >
          {activeTab === "Prayer Wall" ? "Word of the Day" : "Prayer Wall"}
          {activeTab === "Prayer Wall" ? (
            <ArrowRight size={16} weight="regular" />
          ) : (
            <ArrowLeft size={16} weight="regular" />
          )}
        </button>
      </div>

      {activeTab === "Prayer Wall" ? <PrayerWall /> : <WordWall />}
    </section>
  );
}
