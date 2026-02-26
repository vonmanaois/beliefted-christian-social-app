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
import WordCard from "@/components/word/WordCard";
import type { Word } from "@/components/word/types";
import EmptyState from "@/components/ui/EmptyState";
import { BookOpenText } from "@phosphor-icons/react";
import FeedSkeleton from "@/components/ui/FeedSkeleton";
import { readFeedCache, writeFeedCache } from "@/lib/feedCache";

const hashString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

type WordFeedProps = {
  refreshKey: number;
  userId?: string;
  followingOnly?: boolean;
  savedOnly?: boolean;
  mode?: "latest" | "forYou";
  forYouSeed?: number;
};

export default function WordFeed({
  refreshKey,
  userId,
  followingOnly,
  savedOnly,
  mode = "latest",
  forYouSeed = 0,
}: WordFeedProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = useState(6);
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const seenIdsRef = useRef<Set<string>>(new Set());
  const seenSaveTimeoutRef = useRef<number | null>(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const updateSize = () => {
      const isMobile = window.innerWidth < 640;
      if (mode === "forYou") {
        setPageSize(isMobile ? 8 : 12);
      } else {
        setPageSize(isMobile ? 4 : 6);
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, [mode]);
  const viewerId = session?.user?.id ?? null;
  const [forYouTick, setForYouTick] = useState(0);
  const cacheKey = useMemo(
    () =>
      [
        "words",
        viewerId ?? "guest",
        userId ?? "all",
        followingOnly ? "following" : "all",
        savedOnly ? "saved" : "all",
        mode,
      ].join(":"),
    [viewerId, userId, followingOnly, savedOnly, mode]
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
      "words",
      userId,
      refreshKey,
      followingOnly ? "following" : "all",
      savedOnly ? "saved" : "all",
      mode,
      pageSize,
    ],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", String(pageSize));
      if (followingOnly) params.set("following", "true");
      if (savedOnly) params.set("saved", "true");
      if (mode === "forYou") params.set("mode", "forYou");

      const response = await fetch(`/api/words?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load words");
      }
      const data = (await response.json()) as {
        items: Word[];
        nextCursor?: string | null;
      };
      const items = data.items.map((word) => ({
        ...word,
        _id:
          typeof word._id === "string"
            ? word._id
            : String((word._id as { $oid?: string })?.$oid ?? word._id),
        savedBy: Array.isArray(word.savedBy)
          ? word.savedBy.map((id) => String(id))
          : [],
        imageOrientations: Array.isArray(word.imageOrientations)
          ? word.imageOrientations
          : undefined,
        sharedFaithStoryId:
          typeof word.sharedFaithStoryId === "string" ? word.sharedFaithStoryId : null,
        privacy: (word.privacy === "followers" || word.privacy === "private"
          ? word.privacy
          : "public") as Word["privacy"],
        userId: word.userId ? String(word.userId) : undefined,
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
    refetchOnReconnect: mode === "forYou",
  });

  const words = useMemo(() => data?.pages.flatMap((page) => page.items) ?? [], [data?.pages]);
  const forYouShuffleKey = useMemo(() => {
    if (mode !== "forYou") return "";
    const bucket = Math.floor(Date.now() / 180_000);
    return `${viewerId ?? "guest"}:${forYouSeed}:${bucket}:${forYouTick}`;
  }, [mode, viewerId, forYouSeed, forYouTick]);
  const forYouShuffleSeed = useMemo(
    () => hashString(forYouShuffleKey),
    [forYouShuffleKey]
  );
  const rankedWords = useMemo(() => {
    if (mode !== "forYou") return words;
    const now = Date.now();
    return [...words].sort((a, b) => {
      const score = (word: Word) => {
        const likes = word.likedBy?.length ?? 0;
        const comments = word.commentCount ?? 0;
        const saves = word.savedBy?.length ?? 0;
        const createdAt = new Date(word.createdAt).getTime();
        const ageHours = Number.isFinite(createdAt)
          ? Math.max((now - createdAt) / 3_600_000, 0)
          : 0;
        const jitter =
          (hashString(`${forYouShuffleSeed}:${word._id}`) % 1000) / 1000;
        return likes * 2 + comments * 3 + saves * 3 - ageHours * 0.25 + jitter * 1.5;
      };
      return score(b) - score(a);
    });
  }, [mode, words, forYouShuffleSeed]);
  const forYouWords = useMemo(() => {
    if (mode !== "forYou") return rankedWords;
    if (rankedWords.length === 0) return rankedWords;
    const bucketSize = 8;
    const shuffled: Word[] = [];
    for (let i = 0; i < rankedWords.length; i += bucketSize) {
      const bucket = rankedWords.slice(i, i + bucketSize);
      bucket.sort(
        (a, b) =>
          hashString(`${forYouShuffleSeed}:${a._id}`) -
          hashString(`${forYouShuffleSeed}:${b._id}`)
      );
      shuffled.push(...bucket);
    }
    const rotationBase = Math.min(bucketSize, shuffled.length);
    const rotation = rotationBase > 0 ? forYouSeed % rotationBase : 0;
    if (rotation > 0) {
      shuffled.push(...shuffled.splice(0, rotation));
    }
    return shuffled;
  }, [mode, rankedWords, forYouShuffleSeed, forYouSeed]);
  const displayWords = useMemo(() => {
    if (mode !== "forYou") return rankedWords;
    if (seenIds.size === 0) return forYouWords;
    const filtered = forYouWords.filter((word) => !seenIds.has(String(word._id)));
    return filtered.length > 0 ? filtered : forYouWords;
  }, [mode, rankedWords, forYouWords, seenIds]);

  const minForYouFill = useMemo(() => {
    if (mode !== "forYou") return 0;
    return Math.min(pageSize, 8);
  }, [mode, pageSize]);

  const scheduleSeenPersist = useCallback(
    (nextSet: Set<string>) => {
      if (typeof window === "undefined" || mode !== "forYou") return;
      if (seenSaveTimeoutRef.current !== null) {
        window.clearTimeout(seenSaveTimeoutRef.current);
      }
      seenSaveTimeoutRef.current = window.setTimeout(() => {
        seenSaveTimeoutRef.current = null;
        const seenKey = `wordFeedSeen:${viewerId ?? "guest"}`;
        let next = Array.from(nextSet);
        if (next.length > 500) {
          next = next.slice(-500);
        }
        window.localStorage.setItem(seenKey, JSON.stringify(next));
      }, 250);
    },
    [mode, viewerId]
  );

  const addSeenIds = useCallback(
    (ids: string[]) => {
      if (mode !== "forYou" || ids.length === 0) return;
      setSeenIds((prev) => {
        let next = prev;
        let changed = false;
        ids.forEach((id) => {
          if (next.has(id)) return;
          if (!changed) next = new Set(prev);
          next.add(id);
          changed = true;
        });
        if (!changed) return prev;
        seenIdsRef.current = next;
        scheduleSeenPersist(next);
        return next;
      });
    },
    [mode, scheduleSeenPersist]
  );

  useEffect(() => {
    if (mode !== "forYou") {
      setSeenIds(new Set());
      seenIdsRef.current = new Set();
      return;
    }
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(`wordFeedSeen:${viewerId ?? "guest"}`);
    if (!raw) {
      setSeenIds(new Set());
      seenIdsRef.current = new Set();
      return;
    }
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const next = new Set(parsed.map((id) => String(id)));
        setSeenIds(next);
        seenIdsRef.current = next;
      } else {
        setSeenIds(new Set());
        seenIdsRef.current = new Set();
      }
    } catch {
      setSeenIds(new Set());
      seenIdsRef.current = new Set();
    }
  }, [mode, viewerId]);

  useEffect(() => {
    if (mode !== "forYou") return;
    setForYouTick((prev) => prev + 1);
    const id = window.setInterval(() => {
      setForYouTick((prev) => prev + 1);
    }, 180_000);
    return () => window.clearInterval(id);
  }, [mode, forYouSeed]);

  useEffect(() => {
    return () => {
      if (mode !== "forYou" || typeof window === "undefined") return;
      if (seenSaveTimeoutRef.current !== null) {
        window.clearTimeout(seenSaveTimeoutRef.current);
        seenSaveTimeoutRef.current = null;
      }
      const seenKey = `wordFeedSeen:${viewerId ?? "guest"}`;
      let next = Array.from(seenIdsRef.current);
      if (next.length > 500) {
        next = next.slice(-500);
      }
      window.localStorage.setItem(seenKey, JSON.stringify(next));
    };
  }, [mode, viewerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    readFeedCache<Word>(cacheKey).then((cached) => {
      if (cancelled || !cached || cached.items.length === 0) return;
      const existing = queryClient.getQueryData([
        "words",
        userId,
        refreshKey,
        followingOnly ? "following" : "all",
        savedOnly ? "saved" : "all",
        pageSize,
      ]);
      if (existing) return;
      queryClient.setQueryData(
        [
          "words",
          userId,
          refreshKey,
          followingOnly ? "following" : "all",
          savedOnly ? "saved" : "all",
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
    savedOnly,
    userId,
  ]);

  useEffect(() => {
    if (!displayWords.length) return;
    const slice = displayWords.slice(0, 20);
    const firstPage = data?.pages[0];
    writeFeedCache<Word>(cacheKey, {
      items: slice,
      nextCursor: firstPage?.nextCursor ?? null,
      savedAt: Date.now(),
    });
  }, [cacheKey, data?.pages, displayWords]);
  const feedKey = useMemo(
    () =>
      `feed:words:${userId ?? "all"}:${followingOnly ? "following" : "all"}:${
        savedOnly ? "saved" : "all"
      }:${mode}`,
    [userId, followingOnly, savedOnly, mode]
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
  const pendingFetchRef = useRef(false);
  const virtualizationThreshold = 30;
  const useVirtualized = displayWords.length >= virtualizationThreshold;
  const useVirtualizedRef = useRef(useVirtualized);

  useEffect(() => {
    useVirtualizedRef.current = useVirtualized;
  }, [useVirtualized]);

  const prefetchThreshold = 6;

  const handleRangeChanged = useCallback(
    (range: ListRange) => {
      if (mode === "forYou" && displayWords.length > 0) {
        const start = Math.max(0, range.startIndex);
        const end = Math.min(displayWords.length - 1, range.endIndex);
        if (end >= start) {
          const ids: string[] = [];
          for (let i = start; i <= end; i += 1) {
            ids.push(String(displayWords[i]._id));
          }
          addSeenIds(ids);
        }
      }
      if (!hasNextPage) return;
      const nearEnd = range.endIndex >= displayWords.length - prefetchThreshold;
      if (!nearEnd) return;
      if (isFetchingNextPage || isFetching) {
        pendingFetchRef.current = true;
        return;
      }
      fetchNextPage();
    },
    [
      mode,
      displayWords,
      addSeenIds,
      hasNextPage,
      isFetchingNextPage,
      isFetching,
      fetchNextPage,
      prefetchThreshold,
    ]
  );

  useEffect(() => {
    if (!pendingFetchRef.current) return;
    if (!hasNextPage || isFetchingNextPage || isFetching) return;
    pendingFetchRef.current = false;
    fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  useEffect(() => {
    if (mode !== "forYou") return;
    if (isLoading) return;
    if (!hasNextPage || isFetchingNextPage || isFetching) return;
    if (displayWords.length >= minForYouFill) return;
    fetchNextPage();
  }, [
    mode,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    isFetching,
    displayWords.length,
    minForYouFill,
    fetchNextPage,
  ]);

  useEffect(() => {
    if (mode !== "forYou") return;
    refetch();
  }, [mode, forYouSeed, refetch]);

  useEffect(() => {
    if (useVirtualized) return;
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        if (isFetchingNextPage || isFetching) {
          pendingFetchRef.current = true;
          return;
        }
        fetchNextPage();
      },
      { rootMargin: "600px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [useVirtualized, hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (mode !== "forYou") return;
    if (useVirtualized) return;
    if (typeof window === "undefined") return;
    const root = listRef.current;
    if (!root || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const id = (entry.target as HTMLElement).dataset.wordId;
          if (id) addSeenIds([id]);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.4, rootMargin: "0px 0px -15% 0px" }
    );
    const nodes = root.querySelectorAll<HTMLElement>("[data-word-id]");
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [mode, useVirtualized, displayWords, addSeenIds]);

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
            JSON.stringify({ state, count: displayWords.length })
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
  }, [feedKey, displayWords.length, useVirtualized]);

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

  const pullStartRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const pullRafRef = useRef<number | null>(null);
  const lastPullDistanceRef = useRef(0);
  const threshold = 60;

  useEffect(() => {
    const handler = () => {
      refetch();
    };
    window.addEventListener("feed:refresh", handler);
    return () => window.removeEventListener("feed:refresh", handler);
  }, [refetch]);
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
    if (displayWords.length > 0 && saved.count > 0 && displayWords.length + 3 < saved.count) {
      savedSnapshotRef.current = null;
      sessionStorage.removeItem(feedKey);
      setRestoredState(undefined);
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "auto" });
      }
    }
  }, [displayWords.length, feedKey, restoredState]);
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
        <p className="mt-1">We couldn&apos;t load words. Try again.</p>
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

  if (displayWords.length === 0) {
    return (
      <EmptyState
        title={savedOnly ? "No saved posts yet." : "No words yet."}
        description={
          savedOnly
            ? "Save a word to keep it here for later."
            : "Share a word or encouragement to start."
        }
        icon={<BookOpenText size={18} weight="regular" />}
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
              data={displayWords}
              totalCount={displayWords.length}
              useWindowScroll
              increaseViewportBy={{ top: 1600, bottom: 700 }}
              overscan={600}
              restoreStateFrom={restoredState}
              rangeChanged={handleRangeChanged}
              itemContent={(_, word) => (
                <WordCard key={String(word._id)} word={word} savedOnly={savedOnly} />
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
            <div ref={listRef} className="space-y-4">
              {displayWords.map((word) => (
                <div key={String(word._id)} data-word-id={String(word._id)}>
                  <WordCard word={word} savedOnly={savedOnly} />
                </div>
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
