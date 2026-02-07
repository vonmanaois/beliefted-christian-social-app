"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import WordCard from "@/components/word/WordCard";
import EmptyState from "@/components/ui/EmptyState";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type Word = {
  _id: string;
  content: string;
  createdAt: string;
  user?: { name?: string | null; username?: string | null } | null;
  userId?: string | null;
  isOwner?: boolean;
};

type WordFeedProps = {
  refreshKey: number;
  userId?: string;
};

export default function WordFeed({ refreshKey, userId }: WordFeedProps) {
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
    queryKey: ["words", userId, refreshKey],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "20");

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
        userId: word.userId ? String(word.userId) : null,
      }));
      return { items, nextCursor: data.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const words = data?.pages.flatMap((page) => page.items) ?? [];

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
        title="No words yet."
        description="Share a verse or encouragement to start."
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
      {words.map((word) => (
        <WordCard key={word._id} word={word} />
      ))}
      {hasNextPage && (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="mt-4 post-button bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}
