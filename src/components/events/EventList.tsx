"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import EventCard from "@/components/events/EventCard";
import type { EventItem } from "@/components/events/types";

type EventListProps = {
  refreshKey: number;
  tab: "upcoming" | "past";
  onInvite?: (event: EventItem) => void;
  onEdit?: (event: EventItem) => void;
};

export default function EventList({ refreshKey, tab, onInvite, onEdit }: EventListProps) {
  const {
    data,
    isLoading,
    isError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["events", refreshKey, tab],
    queryFn: async ({ pageParam }: { pageParam?: string | null }) => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      if (pageParam) params.set("cursor", pageParam);
      const response = await fetch(`/api/events?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load events");
      }
      return (await response.json()) as { items: EventItem[]; nextCursor?: string | null };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: null,
  });

  const items = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data?.pages]
  );

  if (isLoading) {
    return <p className="text-sm text-[color:var(--subtle)]">Loading events...</p>;
  }

  if (isError) {
    return (
      <div className="flex items-center gap-2 text-sm text-[color:var(--subtle)]">
        <span>Failed to load events.</span>
        <button
          type="button"
          onClick={() => refetch()}
          className="text-[color:var(--accent)] font-semibold"
        >
          Retry
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-[color:var(--subtle)]">
        {tab === "past" ? "No past events yet." : "No upcoming events yet."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((event) => (
        <EventCard key={event._id} event={event} onInvite={onInvite} onEdit={onEdit} />
      ))}
      {hasNextPage ? (
        <button
          type="button"
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
          className="rounded-full px-4 py-2 text-sm font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)] self-start"
        >
          {isFetchingNextPage ? "Loading..." : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
