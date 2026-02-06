"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import WordFeed from "@/components/word/WordFeed";
import PostForm from "@/components/prayer/PostForm";
import WordForm from "@/components/word/WordForm";
import Modal from "@/components/layout/Modal";

const tabs = ["My Prayers", "My Words"] as const;

type Tab = (typeof tabs)[number];

type ProfileTabsProps = {
  userId: string;
  showComposer?: boolean;
};

export default function ProfileTabs({ userId, showComposer = true }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("My Prayers");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPrayerComposer, setShowPrayerComposer] = useState(false);
  const [showWordComposer, setShowWordComposer] = useState(false);
  const { data: session } = useSession();

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
            <button
              type="button"
              onClick={() => setShowPrayerComposer(true)}
              className="composer-trigger cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-slate-600">
                  {session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (session?.user?.name?.[0] ?? "U").toUpperCase()
                  )}
                </span>
                Write a prayer request
              </span>
            </button>
          )}
          <PrayerFeed refreshKey={refreshKey} userId={userId} />
        </>
      ) : (
        <>
          {showComposer && (
            <button
              type="button"
              onClick={() => setShowWordComposer(true)}
              className="composer-trigger cursor-pointer"
            >
              <span className="inline-flex items-center gap-2">
                <span className="h-7 w-7 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-slate-600">
                  {session?.user?.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={session.user.image}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    (session?.user?.name?.[0] ?? "U").toUpperCase()
                  )}
                </span>
                Share God's word today
              </span>
            </button>
          )}
          <WordFeed refreshKey={refreshKey} userId={userId} />
        </>
      )}

      <Modal
        title="Post a Prayer"
        isOpen={showPrayerComposer}
        onClose={() => setShowPrayerComposer(false)}
      >
        <PostForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowPrayerComposer(false);
          }}
        />
      </Modal>

      <Modal
        title="Post a Word"
        isOpen={showWordComposer}
        onClose={() => setShowWordComposer(false)}
      >
        <WordForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowWordComposer(false);
          }}
        />
      </Modal>
    </section>
  );
}
