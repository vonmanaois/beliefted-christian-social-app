"use client";

import { useSession } from "next-auth/react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Virtuoso, type VirtuosoHandle, type StateSnapshot } from "react-virtuoso";
import { UserCircle, UserPlus } from "@phosphor-icons/react";
import Image from "next/image";
import { useUIStore } from "@/lib/uiStore";
import WordCard from "@/components/word/WordCard";
import PrayerCard from "@/components/prayer/PrayerCard";
import type { Word } from "@/components/word/types";
import type { Prayer } from "@/components/prayer/types";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type FollowingItem =
  | { type: "word"; word: Word }
  | { type: "prayer"; prayer: Prayer };

type RestoreState = { ranges: unknown; scrollTop: number };

export default function FollowingWall() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();
  const [isMounted, setIsMounted] = useState(false);

  const {
    data,
    isLoading,
    isError,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
    isFetching,
  } = useInfiniteQuery({
    queryKey: ["following-feed"],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "6");
      const response = await fetch(`/api/following-feed?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load following feed");
      }
      return (await response.json()) as {
        items: FollowingItem[];
        nextCursor?: string | null;
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
    staleTime: 60000,
    gcTime: 900000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: isAuthenticated,
  });

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  const feedKey = "feed:following";
  const savedSnapshotRef = useRef<{ state: RestoreState; count: number } | null>(null);
  const [restoredState, setRestoredState] = useState<RestoreState | undefined>(undefined);
  const [isRestoring, setIsRestoring] = useState(false);
  const restoreOnceRef = useRef(false);
  const restoreRafRef = useRef<number | null>(null);
  const restoreRaf2Ref = useRef<number | null>(null);
  const restoreTimeoutRef = useRef<number | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const saveRafRef = useRef<number | null>(null);

  const pullStartRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const threshold = 60;
  const schedulePullDistance = (nextValue: number) => {
    const clamped = Math.min(nextValue, 90);
    if (Math.abs(clamped - lastPullDistanceRef.current) < 2) return;
    lastPullDistanceRef.current = clamped;
    if (pullRafRef.current !== null) return;
    pullRafRef.current = window.requestAnimationFrame(() => {
      setPullDistance(lastPullDistanceRef.current);
      pullRafRef.current = null;
    });
  };

  const pullRafRef = useRef<number | null>(null);
  const lastPullDistanceRef = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      if (saveRafRef.current !== null) return;
      saveRafRef.current = window.requestAnimationFrame(() => {
        saveRafRef.current = null;
        virtuosoRef.current?.getState((state) => {
          sessionStorage.setItem(
            feedKey,
            JSON.stringify({ state, count: items.length })
          );
        });
      });
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (saveRafRef.current !== null) {
        cancelAnimationFrame(saveRafRef.current);
        saveRafRef.current = null;
      }
    };
  }, [feedKey, items.length]);

  useEffect(() => {
    const raw = sessionStorage.getItem(feedKey);
    if (!raw) {
      savedSnapshotRef.current = null;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoredState(undefined);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { state: RestoreState; count?: number };
      if (
        parsed?.state &&
        typeof parsed.state.scrollTop === "number" &&
        parsed.state.ranges != null
      ) {
        savedSnapshotRef.current = {
          state: parsed.state,
          count: parsed.count ?? 0,
        };
        setRestoredState(parsed.state);
      } else {
        savedSnapshotRef.current = null;
        setRestoredState(undefined);
      }
    } catch {
      savedSnapshotRef.current = null;
      setRestoredState(undefined);
    }
  }, [feedKey]);
  useEffect(() => {
    restoreOnceRef.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRestoring(Boolean(restoredState));
  }, [feedKey, restoredState]);
  useEffect(() => {
    const saved = savedSnapshotRef.current;
    if (!saved || !restoredState) return;
    if (items.length > 0 && saved.count > 0 && items.length + 3 < saved.count) {
      savedSnapshotRef.current = null;
      sessionStorage.removeItem(feedKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRestoredState(undefined);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }, [items.length, feedKey, restoredState]);
  useEffect(() => {
    if (!restoredState) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsRestoring(false);
      return;
    }
    if (restoreOnceRef.current) return;
    restoreOnceRef.current = true;
    setIsRestoring(true);
    if (typeof window === "undefined") {
      setIsRestoring(false);
      return;
    }
    restoreRafRef.current = window.requestAnimationFrame(() => {
      restoreRaf2Ref.current = window.requestAnimationFrame(() => {
        setIsRestoring(false);
      });
    });
    restoreTimeoutRef.current = window.setTimeout(() => {
      setIsRestoring(false);
    }, 240);
    return () => {
      if (restoreRafRef.current !== null) {
        cancelAnimationFrame(restoreRafRef.current);
        restoreRafRef.current = null;
      }
      if (restoreRaf2Ref.current !== null) {
        cancelAnimationFrame(restoreRaf2Ref.current);
        restoreRaf2Ref.current = null;
      }
      if (restoreTimeoutRef.current !== null) {
        clearTimeout(restoreTimeoutRef.current);
        restoreTimeoutRef.current = null;
      }
    };
  }, [restoredState]);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!isAuthenticated) {
    return (
      <section className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}>
        <div className="panel p-6 text-sm text-[color:var(--subtle)]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)]">
              <UserPlus size={18} weight="regular" />
            </span>
            <div>
              <p className="text-[color:var(--ink)] font-semibold">
                Follow people to see their posts.
              </p>
              <p className="mt-1">Sign in to build a following feed.</p>
              <button
                type="button"
                onClick={openSignIn}
                className="mt-3 post-button bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
              >
                Sign in
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}>
        <FeedSkeleton />
      </section>
    );
  }

  if (isError) {
    return (
      <section className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}>
        <div className="panel p-6 text-sm text-[color:var(--subtle)]">
          <p className="text-[color:var(--ink)] font-semibold">Something went wrong.</p>
          <p className="mt-1">We couldn&apos;t load your following feed.</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 post-button bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  if (items.length === 0) {
    return (
      <section className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}>
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              openSignIn();
              return;
            }
            window.dispatchEvent(new Event("open-word-composer"));
          }}
          className="composer-trigger cursor-pointer"
        >
          <span className="inline-flex items-center gap-2">
            <span className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
              {session?.user?.image ? (
                <Image
                  src={session.user.image}
                  alt="Profile"
                  width={56}
                  height={56}
                  sizes="28px"
                  className="h-full w-full object-cover"
                />
              ) : (
                <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
              )}
            </span>
            Share your word
          </span>
        </button>
        <div className="panel p-6 text-sm text-[color:var(--subtle)]">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)]">
              <UserPlus size={18} weight="regular" />
            </span>
            <div>
              <p className="text-[color:var(--ink)] font-semibold">No posts yet.</p>
              <p className="mt-1">Follow more people to see their latest prayers and words.</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}
      onTouchStart={(event) => {
        const scrollTop =
          document.scrollingElement?.scrollTop ?? window.scrollY ?? 0;
        if (scrollTop > 10) return;
        pullStartRef.current = event.touches[0]?.clientY ?? null;
        setIsPulling(true);
      }}
      onTouchMove={(event) => {
        if (!isPulling || pullStartRef.current === null) return;
        const currentY = event.touches[0]?.clientY ?? 0;
        const delta = Math.max(0, currentY - pullStartRef.current);
        schedulePullDistance(delta);
      }}
      onTouchEnd={() => {
        if (pullDistance >= threshold) {
          refetch();
        }
        if (pullRafRef.current !== null) {
          cancelAnimationFrame(pullRafRef.current);
          pullRafRef.current = null;
        }
        lastPullDistanceRef.current = 0;
        setPullDistance(0);
        setIsPulling(false);
        pullStartRef.current = null;
      }}
    >
      {pullDistance > 0 && (
        <div
          className="flex items-center justify-center text-[11px] text-[color:var(--subtle)]"
          style={{ height: pullDistance }}
        >
          {pullDistance >= threshold ? "Release to refresh" : "Pull to refresh"}
        </div>
      )}
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            openSignIn();
            return;
          }
          window.dispatchEvent(new Event("open-word-composer"));
        }}
        className="composer-trigger cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={56}
                height={56}
                sizes="28px"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
            )}
          </span>
          Share your faith
        </span>
      </button>
      {isFetching && (
        <div className="mb-3 loading-bar">
          <div className="loading-bar__fill" />
        </div>
      )}
      <div className="relative min-h-[40vh]">
        {isRestoring && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <FeedSkeleton count={3} />
          </div>
        )}
        <div
          className={`transition-opacity ${
            isRestoring ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          <Virtuoso
            ref={virtuosoRef}
            data={items}
            totalCount={items.length}
            useWindowScroll
            increaseViewportBy={200}
            overscan={200}
            scrollSeekConfiguration={{
              enter: (velocity) => Math.abs(velocity) > 200,
              exit: (velocity) => Math.abs(velocity) < 30,
            }}
            restoreStateFrom={restoredState as unknown as StateSnapshot | undefined}
            itemContent={(_, item) =>
              item.type === "word" ? (
                <WordCard key={`word-${item.word._id}`} word={item.word} />
              ) : (
                <PrayerCard key={`prayer-${item.prayer._id}`} prayer={item.prayer} />
              )
            }
            endReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            components={{
              ScrollSeekPlaceholder: () => <FeedSkeleton count={1} />,
              Footer: () =>
                hasNextPage ? (
                  <div className="flex items-center justify-center py-4">
                    {isFetchingNextPage ? (
                      <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--panel-border)] border-t-[color:var(--accent)]" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-[color:var(--panel-border)]" />
                    )}
                  </div>
                ) : null,
            }}
          />
        </div>
      </div>
    </section>
  );
}
