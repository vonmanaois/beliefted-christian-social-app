"use client";

import { useState } from "react";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";

const tabs = ["Prayer Wall", "Word of the Day"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("Prayer Wall");

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`pill-button border text-sm cursor-pointer ${
              activeTab === tab
                ? "border-transparent bg-[color:var(--accent)] text-white"
                : "border-slate-200 text-[color:var(--ink)]"
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
