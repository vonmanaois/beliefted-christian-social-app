"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import WordFeed from "@/components/word/WordFeed";
import PostForm from "@/components/prayer/PostForm";
import WordForm from "@/components/word/WordForm";
import Modal from "@/components/layout/Modal";

const tabs = ["Prayers", "Words"] as const;

type Tab = (typeof tabs)[number];

type ProfileTabsProps = {
  userId: string;
  showComposer?: boolean;
};

export default function ProfileTabs({ userId, showComposer = true }: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>("Prayers");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPrayerComposer, setShowPrayerComposer] = useState(false);
  const [showWordComposer, setShowWordComposer] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleOpenPrayer = () => {
      setActiveTab("Prayers");
      setShowPrayerComposer(true);
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, []);

  return (
    <section className="mt-6 flex flex-col gap-6">
      <div className="w-full">
        <div className="grid w-full grid-cols-2 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
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

      {activeTab === "Prayers" ? (
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
                Write your new prayer request ...
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
                Share God&apos;s word today
              </span>
            </button>
          )}
          <WordFeed refreshKey={refreshKey} userId={userId} />
        </>
      )}

      <Modal
        title="New Prayer"
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
