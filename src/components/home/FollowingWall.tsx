"use client";

import { useSession } from "next-auth/react";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { UserCircle, UserPlus } from "@phosphor-icons/react";
import Image from "next/image";
import { useUIStore } from "@/lib/uiStore";
import WordCard, { type Word } from "@/components/word/WordCard";
import PrayerCard, { type Prayer } from "@/components/prayer/PrayerCard";
import FeedSkeleton from "@/components/ui/FeedSkeleton";

type FollowingItem =
  | { type: "word"; word: Word }
  | { type: "prayer"; prayer: Prayer };

export default function FollowingWall() {
  const { data: session, status } = useSession();
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
    gcTime: 900000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    enabled: isAuthenticated,
  });

  const pullStartRef = useRef<number | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const threshold = 60;

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
      <section className="feed-surface">
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
      <section className="feed-surface">
        <FeedSkeleton />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="feed-surface">
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

  const items = data?.pages.flatMap((page) => page.items) ?? [];

  if (items.length === 0) {
    return (
      <section className="feed-surface">
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
      className="feed-surface"
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
    </section>
  );
}
