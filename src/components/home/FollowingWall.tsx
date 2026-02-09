"use client";

import { useSession } from "next-auth/react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import EmptyState from "@/components/ui/EmptyState";
import { UserPlus } from "@phosphor-icons/react";
import { useUIStore } from "@/lib/uiStore";
import WordCard from "@/components/word/WordCard";
import PrayerCard, { type Prayer } from "@/components/prayer/PrayerCard";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type Word = {
  _id: string;
  content: string;
  createdAt: string | Date;
  user?: { name?: string | null; username?: string | null; image?: string | null } | null;
  userId?: string;
  isOwner?: boolean;
};

type FollowingItem =
  | { type: "word"; word: Word }
  | { type: "prayer"; prayer: Prayer };

export default function FollowingWall() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

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
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    enabled: isAuthenticated,
  });

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

  if (!isAuthenticated) {
    return (
      <EmptyState
        title="Follow people to see their posts."
        description="Sign in to build a following feed."
        icon={<UserPlus size={18} weight="regular" />}
        actionLabel="Sign in"
        onAction={openSignIn}
      />
    );
  }

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (isError) {
    return (
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
    );
  }

  const items = data?.pages.flatMap((page) => page.items) ?? [];
  if (items.length === 0) {
    return (
      <EmptyState
        title="No posts yet."
        description="Follow more people to see their latest prayers and words."
        icon={<UserPlus size={18} weight="regular" />}
      />
    );
  }

  return (
    <div className="flex flex-col">
      {isFetching && (
        <div className="mb-3 h-1 w-full overflow-hidden rounded-full bg-[color:var(--surface-strong)]">
          <div className="h-full w-1/3 animate-pulse rounded-full bg-[color:var(--accent)]/70" />
        </div>
      )}
      {items.map((item) =>
        item.type === "word" ? (
          <WordCard key={`word-${item.word._id}`} word={item.word} />
        ) : (
          <PrayerCard key={`prayer-${item.prayer._id}`} prayer={item.prayer} />
        )
      )}
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
