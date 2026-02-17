"use client";

import { useEffect } from "react";
import { SessionProvider, signIn, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";
import FollowingWall from "@/components/home/FollowingWall";
import { useUIStore } from "@/lib/uiStore";

const tabs = ["Faith Share", "Prayer Wall", "Following"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  return (
    <SessionProvider>
      <HomeTabsInner />
    </SessionProvider>
  );
}

function HomeTabsInner() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const queryClient = useQueryClient();
  const {
    newWordPosts,
    newPrayerPosts,
    setNewWordPosts,
    setNewPrayerPosts,
    setActiveHomeTab,
    activeHomeTab,
  } = useUIStore();

  const activeIndex =
    activeHomeTab === "prayers" ? 1 : activeHomeTab === "following" ? 2 : 0;
  const activeTab: Tab = tabs[activeIndex];

  useEffect(() => {
    const handleOpenPrayer = () => setActiveHomeTab("prayers");
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, [setActiveHomeTab]);

  useEffect(() => {
    const handleOpenWord = () => setActiveHomeTab("words");
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [setActiveHomeTab]);

  return (
    <div className="flex flex-col gap-6 w-full">
      <div className="hidden md:flex items-center justify-center gap-4 w-full">
        {!isAuthenticated ? (
          <button
            type="button"
            onClick={() => signIn("google")}
            className="inline-flex items-center whitespace-nowrap rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-4 py-2 text-sm font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)] cursor-pointer"
          >
            Sign in
          </button>
        ) : null}
        <div
          className={`flex w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1 ${
            isAuthenticated ? "max-w-none" : "max-w-2xl"
          }`}
        >
          {tabs.map((tab) => {
            const showDot =
              (tab === "Faith Share" && newWordPosts) ||
              (tab === "Prayer Wall" && newPrayerPosts);
            const dotClass =
              activeTab === tab
                ? "bg-[color:var(--accent-contrast)]"
                : "bg-[color:var(--accent)]";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Prayer Wall") {
                    queryClient.invalidateQueries({ queryKey: ["prayers"] });
                    setNewPrayerPosts(false);
                    setActiveHomeTab("prayers");
                    return;
                  }
                  if (tab === "Following") {
                    queryClient.invalidateQueries({ queryKey: ["following-feed"] });
                    setActiveHomeTab("following");
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ["words"] });
                  setNewWordPosts(false);
                  setActiveHomeTab("words");
                }}
                className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "rounded-lg bg-[color:var(--accent)] !text-[color:var(--accent-contrast)] hover:!text-[color:var(--accent-contrast)]"
                    : "rounded-lg text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
                data-active={activeTab === tab ? "true" : "false"}
              >
                <span className="relative z-10 inline-flex items-center gap-1">
                  {tab}
                  {showDot && (
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="md:hidden w-full pt-2">
        <div className="grid w-full max-w-none grid-cols-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1">
          {tabs.map((tab) => {
            const showDot =
              (tab === "Faith Share" && newWordPosts) ||
              (tab === "Prayer Wall" && newPrayerPosts);
            const dotClass =
              activeTab === tab
                ? "bg-[color:var(--accent-contrast)]"
                : "bg-[color:var(--accent)]";
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Prayer Wall") {
                    queryClient.invalidateQueries({ queryKey: ["prayers"] });
                    setNewPrayerPosts(false);
                    setActiveHomeTab("prayers");
                    return;
                  }
                  if (tab === "Following") {
                    queryClient.invalidateQueries({ queryKey: ["following-feed"] });
                    setActiveHomeTab("following");
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ["words"] });
                  setNewWordPosts(false);
                  setActiveHomeTab("words");
                }}
                className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-[color:var(--accent)] !text-[color:var(--accent-contrast)] hover:!text-[color:var(--accent-contrast)]"
                    : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
                data-active={activeTab === tab ? "true" : "false"}
              >
                <span className="relative z-10 inline-flex items-center gap-1">
                  {tab}
                  {showDot && (
                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative w-full overflow-hidden">
        <div
          className="flex w-[300%] transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${activeIndex * (100 / 3)}%)` }}
        >
          <div className="w-full">
            <WordWall />
          </div>
          <div className="w-full">
            <PrayerWall />
          </div>
          <div className="w-full">
            <FollowingWall />
          </div>
        </div>
      </div>
    </div>
  );
}
