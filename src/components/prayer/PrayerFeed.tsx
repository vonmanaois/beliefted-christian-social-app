"use client";

import { keepPreviousData, useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import {
  Virtuoso,
  type ListRange,
  type VirtuosoHandle,
  type StateSnapshot,
} from "react-virtuoso";
import PrayerCard from "@/components/prayer/PrayerCard";
import type { Prayer } from "@/components/prayer/types";
import EmptyState from "@/components/ui/EmptyState";
import { HandsClapping } from "@phosphor-icons/react";
import FeedSkeleton from "@/components/ui/FeedSkeleton";
import { readFeedCache, writeFeedCache } from "@/lib/feedCache";

type PrayerFeedProps = {
  refreshKey: number;
  userId?: string;
  followingOnly?: boolean;
  reprayedOnly?: boolean;
};

export default function PrayerFeed({ refreshKey, userId, followingOnly, reprayedOnly }: PrayerFeedProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(6);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateSize = () => {
      setPageSize(window.innerWidth < 640 ? 4 : 6);
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);
  const viewerId = session?.user?.id ?? null;
  const cacheKey = useMemo(
    () =>
      [
        "prayers",
        viewerId ?? "guest",
        userId ?? "all",
        followingOnly ? "following" : "all",
        reprayedOnly ? "reprayed" : "all",
      ].join(":"),
    [viewerId, userId, followingOnly, reprayedOnly]
  );

  const {
    data,
    isLoading,
    isFetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: [
      "prayers",
      userId,
      refreshKey,
      followingOnly ? "following" : "all",
      reprayedOnly ? "reprayed" : "all",
      pageSize,
    ],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", String(pageSize));
      if (followingOnly) params.set("following", "true");
      if (reprayedOnly) params.set("reprayed", "true");

      const response = await fetch(`/api/prayers?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load prayers");
      }
      const data = (await response.json()) as {
        items: Prayer[];
        nextCursor?: string | null;
      };
      const items = data.items.map((prayer) => ({
        ...prayer,
        _id:
          typeof prayer._id === "string"
            ? prayer._id
            : String((prayer._id as { $oid?: string })?.$oid ?? prayer._id),
        prayedBy: Array.isArray(prayer.prayedBy)
          ? prayer.prayedBy.map((id) => String(id))
          : [],
        privacy: (prayer.privacy === "followers" || prayer.privacy === "private"
          ? prayer.privacy
          : "public") as Prayer["privacy"],
        userId: prayer.userId ? String(prayer.userId) : undefined,
      }));
      return { items, nextCursor: data.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
    staleTime: 180000,
    gcTime: 900000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  const pullStartRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullRafRef = useRef<number | null>(null);
  const lastPullDistanceRef = useRef(0);
  const threshold = 60;
  const prefetchThreshold = 6;

  useEffect(() => {
    const handler = () => {
      refetch();
    };
    window.addEventListener("feed:refresh", handler);
    return () => window.removeEventListener("feed:refresh", handler);
  }, [refetch]);

  const prayers = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    readFeedCache<Prayer>(cacheKey).then((cached) => {
      if (cancelled || !cached || cached.items.length === 0) return;
      const existing = queryClient.getQueryData([
        "prayers",
        userId,
        refreshKey,
        followingOnly ? "following" : "all",
        reprayedOnly ? "reprayed" : "all",
        pageSize,
      ]);
      if (existing) return;
      queryClient.setQueryData(
        [
          "prayers",
          userId,
          refreshKey,
          followingOnly ? "following" : "all",
          reprayedOnly ? "reprayed" : "all",
          pageSize,
        ],
        {
          pages: [{ items: cached.items, nextCursor: cached.nextCursor }],
          pageParams: [null],
        }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [
    cacheKey,
    followingOnly,
    pageSize,
    queryClient,
    refreshKey,
    reprayedOnly,
    userId,
  ]);

  useEffect(() => {
    if (!prayers.length) return;
    const slice = prayers.slice(0, 20);
    const firstPage = data?.pages[0];
    writeFeedCache<Prayer>(cacheKey, {
      items: slice,
      nextCursor: firstPage?.nextCursor ?? null,
      savedAt: Date.now(),
    });
  }, [cacheKey, data?.pages, prayers]);

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (!hasNextPage || isFetchingNextPage || isFetching) return;
      if (range.endIndex >= prayers.length - prefetchThreshold) {
        fetchNextPage();
      }
    },
    [hasNextPage, isFetchingNextPage, isFetching, prayers.length, fetchNextPage]
  );
  const feedKey = useMemo(
    () =>
      `feed:prayers:${userId ?? "all"}:${followingOnly ? "following" : "all"}:${
        reprayedOnly ? "reprayed" : "all"
      }`,
    [userId, followingOnly, reprayedOnly]
  );
  const savedSnapshotRef = useRef<{ state: StateSnapshot; count: number } | null>(null);
  const [restoredState, setRestoredState] = useState<StateSnapshot | undefined>(undefined);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const restoreOnceRef = useRef(false);
  const restoreRafRef = useRef<number | null>(null);
  const restoreRaf2Ref = useRef<number | null>(null);
  const restoreTimeoutRef = useRef<number | null>(null);
  const virtuosoRef = useRef<VirtuosoHandle | null>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const scrollSaveTimeoutRef = useRef<number | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const virtualizationThreshold = 30;
  const useVirtualized = prayers.length >= virtualizationThreshold;
  const useVirtualizedRef = useRef(useVirtualized);

  useEffect(() => {
    useVirtualizedRef.current = useVirtualized;
  }, [useVirtualized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!useVirtualized) return;
    const handleScroll = () => {
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(() => {
        saveTimeoutRef.current = null;
        virtuosoRef.current?.getState((state) => {
          sessionStorage.setItem(
            feedKey,
            JSON.stringify({ state, count: prayers.length })
          );
        });
      }, 220);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (saveTimeoutRef.current !== null) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
    };
  }, [feedKey, prayers.length, useVirtualized]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (useVirtualized) return;
    const handleScroll = () => {
      if (scrollSaveTimeoutRef.current !== null) {
        window.clearTimeout(scrollSaveTimeoutRef.current);
      }
      scrollSaveTimeoutRef.current = window.setTimeout(() => {
        scrollSaveTimeoutRef.current = null;
        sessionStorage.setItem(`${feedKey}:scrollY`, String(window.scrollY));
      }, 160);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollSaveTimeoutRef.current !== null) {
        window.clearTimeout(scrollSaveTimeoutRef.current);
        scrollSaveTimeoutRef.current = null;
      }
    };
  }, [feedKey, useVirtualized]);

  useEffect(() => {
    if (useVirtualized) return;
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isFetchingNextPage || isFetching) return;
        fetchNextPage();
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [useVirtualized, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!useVirtualizedRef.current) {
      const saved = sessionStorage.getItem(`${feedKey}:scrollY`);
      if (saved) {
        window.scrollTo({ top: Number(saved) || 0, behavior: "auto" });
      }
      if (!isReady) setIsReady(true);
      return;
    }
    const raw = sessionStorage.getItem(feedKey);
    if (!raw) {
      savedSnapshotRef.current = null;
      setRestoredState(undefined);
      if (!isReady) setIsReady(true);
      return;
    }
    try {
      const parsed = JSON.parse(raw) as { state?: StateSnapshot; count?: number };
      if (
        parsed?.state &&
        typeof parsed.state.scrollTop === "number" &&
        Array.isArray(parsed.state.ranges)
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
    } finally {
      if (!isReady) setIsReady(true);
    }
  }, [feedKey, isReady]);
  useEffect(() => {
    restoreOnceRef.current = false;
    setIsRestoring(Boolean(restoredState));
  }, [feedKey, restoredState]);
  useEffect(() => {
    const saved = savedSnapshotRef.current;
    if (!saved || !restoredState) return;
    if (prayers.length > 0 && saved.count > 0 && prayers.length + 3 < saved.count) {
      savedSnapshotRef.current = null;
      sessionStorage.removeItem(feedKey);
      setRestoredState(undefined);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }, [prayers.length, feedKey, restoredState]);
  useEffect(() => {
    if (!restoredState) {
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


  if (!isReady || isLoading) {
    return <FeedSkeleton count={2} />;
  }

  if (isError) {
    return (
      <div className="panel p-6 text-sm text-[color:var(--subtle)]">
        <p className="text-[color:var(--ink)] font-semibold">Something went wrong.</p>
        <p className="mt-1">We couldn&apos;t load prayers. Try again.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-4 post-button bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
        >
          Retry
        </button>
      </div>
    );
  }

  if (prayers.length === 0) {
    return (
      <EmptyState
        title={reprayedOnly ? "No prayed prayers yet." : "No prayers yet."}
        description={
          reprayedOnly
            ? "Pray for a prayer to show it here."
            : "Be the first to share something uplifting."
        }
        icon={<HandsClapping size={18} weight="regular" />}
      />
    );
  }

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

  return (
    <div
      className="flex flex-col"
      onTouchStart={(event) => {
        if (window.scrollY > 10) return;
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
      {isFetching && (
        <div className="mb-3 loading-bar">
          <div className="loading-bar__fill" />
        </div>
      )}
      <div className="relative min-h-[40vh]">
        {useVirtualized && isRestoring && (
          <div className="pointer-events-none absolute inset-0 z-10">
            <FeedSkeleton count={2} />
          </div>
        )}
        <div
          className={`transition-opacity ${
            useVirtualized && isRestoring ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}
        >
          {useVirtualized ? (
            <Virtuoso
              ref={virtuosoRef}
              data={prayers}
              totalCount={prayers.length}
              useWindowScroll
              increaseViewportBy={{ top: 1600, bottom: 700 }}
              overscan={600}
              restoreStateFrom={restoredState}
              rangeChanged={handleRangeChanged}
              itemContent={(_, prayer) => (
                <PrayerCard key={prayer._id} prayer={prayer} />
              )}
              endReached={() => {
                if (hasNextPage && !isFetchingNextPage) {
                  fetchNextPage();
                }
              }}
              components={{
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
          ) : (
            <div className="space-y-4">
              {prayers.map((prayer) => (
                <PrayerCard key={prayer._id} prayer={prayer} />
              ))}
              {hasNextPage && (
                <div ref={loadMoreRef} className="flex items-center justify-center py-4">
                  {isFetchingNextPage ? (
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--panel-border)] border-t-[color:var(--accent)]" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-[color:var(--panel-border)]" />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
