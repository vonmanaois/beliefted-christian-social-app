"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import EmptyState from "@/components/ui/EmptyState";
import { BellSimple, X } from "@phosphor-icons/react";

type NotificationActor = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};
type NotificationRecipient = { username?: string | null };
type NotificationItem = {
  _id: string;
  type:
    | "pray"
    | "comment"
    | "word_like"
    | "word_comment"
    | "follow"
    | "faith_like"
    | "faith_comment"
    | "mention"
    | "moderation";
  createdAt: string;
  actorId?: NotificationActor | null;
  userId?: NotificationRecipient | null;
  prayerId?: { _id?: string; content?: string; authorUsername?: string | null } | null;
  wordId?: { _id?: string; content?: string; authorUsername?: string | null } | null;
  faithStoryId?: { _id?: string; title?: string; authorUsername?: string | null } | null;
  moderationReason?: string | null;
  moderationTarget?: "word" | "prayer" | "faith_story" | null;
  isFollowing?: boolean;
};

const formatNotificationTime = (timestamp: string) => {
  const createdAt = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}min`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h`;
  }

  const sameYear = createdAt.getFullYear() === now.getFullYear();
  const options: Intl.DateTimeFormatOptions = sameYear
    ? { month: "short", day: "numeric" }
    : { month: "short", day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", options).format(createdAt);
};

type NotificationsContentProps = {
  active?: boolean;
  onNavigate?: () => void;
};

export default function NotificationsContent({
  active = false,
  onNavigate,
}: NotificationsContentProps) {
  const { status, data: session } = useSession();
  const isAuthenticated = status === "authenticated";
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", session?.user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      return (await response.json()) as NotificationItem[];
    },
    enabled: isAuthenticated && active,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
  });

  // Fetch only when drawer is opened and something is stale or missing.

  const clearMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notifications", { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to clear notifications");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", session?.user?.id ?? "guest"],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "count", session?.user?.id ?? "guest"],
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/notifications/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete notification");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notifications", session?.user?.id ?? "guest"],
      });
      queryClient.invalidateQueries({
        queryKey: ["notifications", "count", session?.user?.id ?? "guest"],
      });
    },
  });

  const followBackMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!response.ok) {
        throw new Error("Failed to follow back");
      }
    },
    onSuccess: (_data, userId) => {
      queryClient.setQueryData<NotificationItem[]>(
        ["notifications", session?.user?.id ?? "guest"],
        (current = []) =>
        current.map((note) =>
          note.type === "follow" && note.actorId?._id === userId
            ? { ...note, isFollowing: true }
            : note
        )
      );
      queryClient.invalidateQueries({
        queryKey: ["notifications", "count", session?.user?.id ?? "guest"],
      });
    },
  });

  const getNotificationHref = (note: NotificationItem) => {
    const recipient = note.userId?.username;
    const actor = note.actorId?.username;
    if (note.type === "follow") {
      return actor ? `/profile/${actor}` : "/profile";
    }
    if (note.wordId?._id) {
      const author = note.wordId.authorUsername ?? recipient;
      return author ? `/${author}/${note.wordId._id}` : null;
    }
    if (note.prayerId?._id) {
      const author = note.prayerId.authorUsername ?? recipient;
      return author ? `/${author}/${note.prayerId._id}` : null;
    }
    if (note.faithStoryId?._id) {
      const author = note.faithStoryId.authorUsername ?? recipient;
      return author ? `/faith-story/${author}/${note.faithStoryId._id}` : null;
    }
    return null;
  };

  const getModerationLabel = (target?: NotificationItem["moderationTarget"]) => {
    if (target === "prayer") return "prayer";
    if (target === "faith_story") return "faith story";
    return "word";
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--ink)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-[color:var(--subtle)]">
            Stay updated when someone interacts with your prayers or words.
          </p>
        </div>
        {isAuthenticated && notifications.length > 0 && (
          <button
            type="button"
            onClick={() => clearMutation.mutate()}
            className="post-button bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
          >
            Clear all
          </button>
        )}
      </div>

      {!isAuthenticated ? (
        <div className="mt-6 panel p-4 text-sm text-[color:var(--subtle)]">
          <p className="text-[color:var(--ink)] font-semibold">
            Sign in to see notifications.
          </p>
          <button
            type="button"
            onClick={() => signIn("google")}
            className="mt-4 pill-button bg-slate-900 text-white cursor-pointer inline-flex items-center gap-2"
          >
            Continue with Google
          </button>
        </div>
      ) : isLoading ? (
        <div className="mt-6 flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="panel p-3">
              <div className="h-3 w-40 bg-slate-200 rounded-full animate-pulse" />
              <div className="mt-2 h-3 w-32 bg-slate-200 rounded-full animate-pulse" />
            </div>
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="All caught up."
            description="When someone interacts, you’ll see it here."
            icon={<BellSimple size={18} weight="regular" />}
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {notifications.map((note) => (
            <div key={note._id} className="panel p-3">
              <div className="flex items-start justify-between gap-3">
                {(() => {
                  const href = getNotificationHref(note);
                  const content = (
                    <>
                      <p className="text-sm text-[color:var(--ink)]">
                        {note.type === "moderation" ? (
                          <>
                            <span className="font-semibold">Beliefted Team</span>{" "}
                            removed your {getModerationLabel(note.moderationTarget)} for{" "}
                            <span className="font-semibold">
                              {note.moderationReason ?? "Community Guidelines"}
                            </span>
                            .
                          </>
                        ) : (
                          <>
                            <span className="font-semibold">
                              {note.actorId?.name ?? "Someone"}
                            </span>{" "}
                            {note.type === "pray"
                              ? "prayed for your prayer."
                              : note.type === "comment"
                                ? "posted encouragement on your prayer."
                                : note.type === "word_like"
                                  ? "liked your word."
                                  : note.type === "word_comment"
                                    ? "posted reflection on your word."
                                    : note.type === "faith_like"
                                      ? "liked your faith story."
                                      : note.type === "faith_comment"
                                        ? "posted reflection on your faith story."
                                        : note.type === "mention"
                                          ? note.wordId
                                            ? "mentioned you in a word."
                                            : note.prayerId
                                              ? "mentioned you in a prayer."
                                              : note.faithStoryId
                                                ? "mentioned you in a faith story."
                                                : "mentioned you."
                                        : "followed you."}
                          </>
                        )}
                      </p>
                    </>
                  );
                  return href ? (
                    <Link
                      href={href}
                      prefetch={false}
                      className="flex-1 cursor-pointer"
                      scroll={false}
                      onClick={onNavigate}
                    >
                      {content}
                    </Link>
                  ) : (
                    <div className="flex-1">{content}</div>
                  );
                })()}
                <div className="flex items-center gap-2">
                  {note.type === "follow" && note.actorId?._id && !note.isFollowing && (
                    <button
                      type="button"
                      onClick={() => followBackMutation.mutate(note.actorId?._id ?? "")}
                      className="rounded-lg px-3 py-1 text-xs font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                    >
                      Follow back
                    </button>
                  )}
                  <span className="text-[11px] text-[color:var(--subtle)] whitespace-nowrap">
                    {formatNotificationTime(note.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => deleteMutation.mutate(note._id)}
                    className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] flex items-center justify-center"
                    aria-label="Dismiss notification"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
