"use client";

import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import WordCard, { type Word } from "@/components/word/WordCard";
import EmptyState from "@/components/ui/EmptyState";
import { BookOpenText } from "@phosphor-icons/react";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type WordFeedProps = {
  refreshKey: number;
  userId?: string;
  followingOnly?: boolean;
  savedOnly?: boolean;
};

export default function WordFeed({ refreshKey, userId, followingOnly, savedOnly }: WordFeedProps) {
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
    ],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "6");
      if (followingOnly) params.set("following", "true");
      if (savedOnly) params.set("saved", "true");

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
  });

  const words = data?.pages.flatMap((page) => page.items) ?? [];

  const pullStartRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const threshold = 60;
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = () => {
      refetch();
    };
    window.addEventListener("feed:refresh", handler);
    return () => window.removeEventListener("feed:refresh", handler);
  }, [refetch]);

  useEffect(() => {
    if (!hasNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  if (isLoading) {
    return <FeedSkeleton />;
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

  if (words.length === 0) {
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

  return (
    <div
      className="flex flex-col"
      onTouchStart={(event) => {
        if (window.scrollY > 0) return;
        pullStartRef.current = event.touches[0]?.clientY ?? null;
        setIsPulling(true);
      }}
      onTouchMove={(event) => {
        if (!isPulling || pullStartRef.current === null) return;
        const currentY = event.touches[0]?.clientY ?? 0;
        const delta = Math.max(0, currentY - pullStartRef.current);
        setPullDistance(Math.min(delta, 90));
      }}
      onTouchEnd={() => {
        if (pullDistance >= threshold) {
          refetch();
        }
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
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-strong)]">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[color:var(--accent)]/70" />
        </div>
      )}
      {words.map((word) => (
        <WordCard key={word._id} word={word} savedOnly={savedOnly} />
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
  );
}
