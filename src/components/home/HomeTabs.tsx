"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import { useQueryClient } from "@tanstack/react-query";
import PrayerWall from "@/components/prayer/PrayerWall";
import WordWall from "@/components/word/WordWall";
import FollowingWall from "@/components/home/FollowingWall";
import { useUIStore } from "@/lib/uiStore";

const tabs = ["Faith Share", "Prayer Wall", "Following"] as const;

type Tab = (typeof tabs)[number];

export default function HomeTabs() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const { newWordPosts, newPrayerPosts, setNewWordPosts, setNewPrayerPosts } = useUIStore();

  const activeTab = useMemo<Tab>(() => {
    if (pathname === "/prayerwall") {
      return "Prayer Wall";
    }
    if (pathname === "/following") {
      return "Following";
    }
    return "Faith Share";
  }, [pathname]);

  useEffect(() => {
    const handleOpenPrayer = () => {
      router.push("/prayerwall");
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, [router]);

  useEffect(() => {
    const handleOpenWord = () => {
      router.push("/");
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [router]);

  useEffect(() => {
    const prefetchWords = () =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ["words", undefined, 0],
        initialPageParam: null,
        queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
          const params = new URLSearchParams();
          if (pageParam) params.set("cursor", pageParam);
          params.set("limit", "6");
          const response = await fetch(`/api/words?${params.toString()}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error("Failed to prefetch words");
          }
          return response.json();
        },
      });

    const prefetchPrayers = () =>
      queryClient.prefetchInfiniteQuery({
        queryKey: ["prayers", undefined, 0],
        initialPageParam: null,
        queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
          const params = new URLSearchParams();
          if (pageParam) params.set("cursor", pageParam);
          params.set("limit", "6");
          const response = await fetch(`/api/prayers?${params.toString()}`, {
            cache: "no-store",
          });
          if (!response.ok) {
            throw new Error("Failed to prefetch prayers");
          }
          return response.json();
        },
      });

    if (activeTab === "Prayer Wall") {
      void prefetchWords();
    } else if (activeTab === "Faith Share") {
      void prefetchPrayers();
    }
  }, [activeTab, queryClient]);

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
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Prayer Wall") {
                    queryClient.invalidateQueries({ queryKey: ["prayers"] });
                    setNewPrayerPosts(false);
                    router.push("/prayerwall");
                    return;
                  }
                  if (tab === "Following") {
                    router.push("/following");
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ["words"] });
                  setNewWordPosts(false);
                  router.push("/");
                }}
                className={`flex-1 px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab
                    ? "rounded-lg bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                    : "rounded-lg text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {tab}
                  {showDot && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
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
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === "Prayer Wall") {
                    queryClient.invalidateQueries({ queryKey: ["prayers"] });
                    setNewPrayerPosts(false);
                    router.push("/prayerwall");
                    return;
                  }
                  if (tab === "Following") {
                    router.push("/following");
                    return;
                  }
                  queryClient.invalidateQueries({ queryKey: ["words"] });
                  setNewWordPosts(false);
                  router.push("/");
                }}
                className={`w-full rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab
                    ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                    : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                }`}
              >
                <span className="inline-flex items-center gap-1">
                  {tab}
                  {showDot && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[color:var(--accent)]" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "Prayer Wall" ? (
        <PrayerWall />
      ) : activeTab === "Following" ? (
        <FollowingWall />
      ) : (
        <WordWall />
      )}
    </section>
  );
}
