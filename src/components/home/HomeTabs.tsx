"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft } from "@phosphor-icons/react";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";

const tabs = ["Prayer Wall", "Word of the Day"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("Prayer Wall");
  const [openPrayerComposerKey, setOpenPrayerComposerKey] = useState(0);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/wordoftheday" || pathname === "/word") {
      setActiveTab("Word of the Day");
    } else {
      setActiveTab("Prayer Wall");
    }
  }, [pathname]);

  useEffect(() => {
    const handleOpenPrayer = () => {
      setActiveTab("Prayer Wall");
      setOpenPrayerComposerKey((prev) => prev + 1);
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, []);

  return (
    <section className="flex flex-col gap-6">
      <div className="hidden md:flex items-center justify-end">
        <div className="inline-flex rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
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
            setActiveTab(next);
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

      {activeTab === "Prayer Wall" ? (
        <PrayerWall openComposerKey={openPrayerComposerKey} />
      ) : (
        <WordWall />
      )}
    </section>
  );
}
