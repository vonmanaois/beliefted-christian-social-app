"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowClockwise } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";

type SuggestionUser = {
  id: string;
  username?: string | null;
  name?: string | null;
  image?: string | null;
  bio?: string | null;
};

export default function FollowSuggestions() {
  const { data: session, status } = useSession();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [exitingIds, setExitingIds] = useState<string[]>([]);
  const [enteringIds, setEnteringIds] = useState<string[]>([]);
  const [pendingFollowId, setPendingFollowId] = useState<string | null>(null);
  const previousVisibleIdsRef = useRef<string[]>([]);

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["search-follow-suggestions", session?.user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/users/suggestions", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load suggestions");
      }
      return (await response.json()) as SuggestionUser[];
    },
    enabled: status === "authenticated",
  });

  const followMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error("Failed to follow user");
      }

      return userId;
    },
    onMutate: (userId) => {
      setPendingFollowId(userId);
      setExitingIds((current) => (current.includes(userId) ? current : [...current, userId]));
    },
    onError: (_, userId) => {
      setPendingFollowId(null);
      setExitingIds((current) => current.filter((id) => id !== userId));
    },
    onSuccess: (userId) => {
      window.setTimeout(() => {
        setDismissedIds((current) => (current.includes(userId) ? current : [...current, userId]));
        setExitingIds((current) => current.filter((id) => id !== userId));
        setPendingFollowId((current) => (current === userId ? null : current));
        void refetch();
      }, 260);
    },
  });

  const visibleSuggestions = useMemo(
    () => data.filter((user) => !dismissedIds.includes(user.id)),
    [data, dismissedIds]
  );

  useEffect(() => {
    const previousIds = previousVisibleIdsRef.current;
    const nextIds = visibleSuggestions.map((user) => user.id);
    const insertedIds = nextIds.filter((id) => !previousIds.includes(id));

    if (insertedIds.length > 0 && previousIds.length > 0) {
      setEnteringIds((current) => Array.from(new Set([...current, ...insertedIds])));
      const timeout = window.setTimeout(() => {
        setEnteringIds((current) => current.filter((id) => !insertedIds.includes(id)));
      }, 380);
      previousVisibleIdsRef.current = nextIds;
      return () => window.clearTimeout(timeout);
    }

    previousVisibleIdsRef.current = nextIds;
  }, [visibleSuggestions]);

  if (status !== "authenticated") return null;
  if (isLoading) {
    return (
      <div className="mt-8 rounded-2xl border border-[color:var(--panel-border)] p-4">
        <p className="text-sm font-semibold text-[color:var(--ink)]">Who to follow</p>
        <p className="mt-2 text-xs text-[color:var(--subtle)]">Loading suggestions...</p>
      </div>
    );
  }

  if (visibleSuggestions.length === 0) return null;

  return (
    <section className="mt-8 rounded-2xl border border-[color:var(--panel-border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[color:var(--ink)]">Who to follow</h2>
          <p className="mt-1 text-xs text-[color:var(--subtle)]">
            Accounts you have not followed yet.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void refetch();
          }}
          disabled={isFetching}
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)] disabled:opacity-60"
        >
          <ArrowClockwise
            size={14}
            className={isFetching ? "animate-spin" : undefined}
          />
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {visibleSuggestions.map((user) => (
          <div
            key={user.id}
            className={[
              "follow-suggestion-card flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--panel-border)] px-3 py-3",
              exitingIds.includes(user.id) ? "follow-suggestion-card--exit" : "",
              enteringIds.includes(user.id) ? "follow-suggestion-card--enter" : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Link
              href={user.username ? `/profile/${user.username}` : "/profile"}
              prefetch={false}
              className="flex min-w-0 flex-1 items-center gap-3"
            >
              <Avatar
                src={user.image ?? null}
                alt={user.name ?? "User"}
                size={44}
                fallback={(user.name?.[0] ?? "U").toUpperCase()}
                className="h-11 w-11 shrink-0 text-sm"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[color:var(--ink)]">
                  {user.name ?? "User"}
                </p>
                {user.username ? (
                  <p className="truncate text-xs text-[color:var(--subtle)]">
                    @{user.username}
                  </p>
                ) : null}
                {user.bio ? (
                  <p className="mt-1 line-clamp-2 text-xs text-[color:var(--subtle)]">
                    {user.bio}
                  </p>
                ) : null}
              </div>
            </Link>

            <button
              type="button"
              onClick={() => followMutation.mutate(user.id)}
              disabled={followMutation.isPending || pendingFollowId === user.id}
              className="shrink-0 rounded-full bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] disabled:opacity-60"
            >
              {pendingFollowId === user.id ? "Following..." : "Follow"}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
