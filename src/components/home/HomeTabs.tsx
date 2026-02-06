"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";

const tabs = ["Prayer Wall", "Word of the Day"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("Prayer Wall");
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/wordoftheday" || pathname === "/word") {
      setActiveTab("Word of the Day");
    } else {
      setActiveTab("Prayer Wall");
    }
  }, [pathname]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3 justify-end">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              router.push(tab === "Prayer Wall" ? "/" : "/wordoftheday");
            }}
            className={`pill-button text-sm cursor-pointer transition ${
              activeTab === tab
                ? "bg-[color:var(--accent)] text-white shadow-sm"
                : "bg-[color:var(--panel)] text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Prayer Wall" ? <PrayerWall /> : <WordWall />}
    </section>
  );
}
