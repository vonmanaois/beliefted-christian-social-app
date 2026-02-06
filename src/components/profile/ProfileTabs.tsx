"use client";

import { useState } from "react";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import WordFeed from "@/components/word/WordFeed";
import PostForm from "@/components/prayer/PostForm";
import WordForm from "@/components/word/WordForm";

const tabs = ["My Prayers", "My Words"] as const;

type Tab = (typeof tabs)[number];

type ProfileTabsProps = {
  userId: string;
  showComposer?: boolean;
};

export default function ProfileTabs({ userId, showComposer = true }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("My Prayers");
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="mt-6 flex flex-col gap-6">
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

      {activeTab === "My Prayers" ? (
        <>
          {showComposer && (
            <PostForm compact flat onPosted={() => setRefreshKey((prev) => prev + 1)} />
          )}
          <PrayerFeed refreshKey={refreshKey} userId={userId} />
        </>
      ) : (
        <>
          {showComposer && (
            <WordForm compact flat onPosted={() => setRefreshKey((prev) => prev + 1)} />
          )}
          <WordFeed refreshKey={refreshKey} userId={userId} />
        </>
      )}
    </section>
  );
}
