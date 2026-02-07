"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import PrayerCard, { type Prayer } from "@/components/prayer/PrayerCard";
import EmptyState from "@/components/ui/EmptyState";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type PrayerFeedProps = {
  refreshKey: number;
  userId?: string;
};

export default function PrayerFeed({ refreshKey, userId }: PrayerFeedProps) {
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
    queryKey: ["prayers", userId, refreshKey],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      if (userId) params.set("userId", userId);
      if (pageParam) params.set("cursor", pageParam);
      params.set("limit", "20");

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
        userId: prayer.userId ? String(prayer.userId) : null,
      }));
      return { items, nextCursor: data.nextCursor ?? null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
    staleTime: 10000,
    refetchOnWindowFocus: true,
  });

  const prayers = data?.pages.flatMap((page) => page.items) ?? [];

  if (isLoading) {
    return <FeedSkeleton />;
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
        title="No prayers yet."
        description="Be the first to share something uplifting."
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
      {prayers.map((prayer) => (
        <PrayerCard key={prayer._id} prayer={prayer} />
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
