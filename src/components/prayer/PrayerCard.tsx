"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export type PrayerUser = {
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type Prayer = {
  _id: string | { $oid?: string };
  content: string;
  createdAt: string;
  isAnonymous: boolean;
  prayedBy: string[];
  commentCount?: number;
  user?: PrayerUser | null;
  userId?: string;
  isOwner?: boolean;
};

type PrayerCardProps = {
  prayer: Prayer;
};

type CommentUser = {
  name?: string | null;
  image?: string | null;
};

type Comment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
};

export default function PrayerCard({ prayer }: PrayerCardProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const normalizeId = (raw: Prayer["_id"]) => {
    if (typeof raw === "string") {
      return raw.replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
    }
    const asObj = raw as { $oid?: string; toString?: () => string };
    if (asObj?.$oid) return asObj.$oid;
    if (asObj?.toString) return asObj.toString().replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
    return String(raw);
  };
  const prayerId = normalizeId(prayer._id);
  const [count, setCount] = useState(prayer.prayedBy.length);
  const [isPending, setIsPending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(prayer.commentCount ?? 0);
  const [showMenu, setShowMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(prayer.content);
  const [editText, setEditText] = useState(prayer.content);
  const [hasPrayed, setHasPrayed] = useState(
    session?.user?.id ? prayer.prayedBy.includes(String(session.user.id)) : false
  );
  const isOwner =
    prayer.isOwner ??
    Boolean(
      session?.user?.id &&
        prayer.userId &&
        String(prayer.userId) === String(session.user.id)
    );


  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["prayer-comments", prayerId],
    queryFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as Comment[];
    },
    enabled: showComments,
  });

  useEffect(() => {
    if (showComments) {
      setCommentCount(comments.length);
    }
  }, [comments.length, showComments]);

  useEffect(() => {
    if (!session?.user?.id) return;
    if (prayer.prayedBy.includes(String(session.user.id))) {
      setHasPrayed(true);
    }
  }, [prayer.prayedBy, session?.user?.id]);

  const commentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prayerId,
          content: commentText.trim(),
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to post comment");
      }
    },
    onSuccess: async () => {
      setCommentText("");
      await queryClient.invalidateQueries({
        queryKey: ["prayer-comments", prayerId],
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (!response.ok) {
        let message = "Failed to update prayer";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }
      return (await response.json()) as { content: string };
    },
    onSuccess: async (data) => {
      setContent(data.content);
      setIsEditing(false);
      await queryClient.invalidateQueries({ queryKey: ["prayers"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Failed to delete prayer";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors
        }
        if (response.status === 401) {
          signIn("google");
        }
        throw new Error(message);
      }
    },
    onSuccess: async () => {
      setShowMenu(false);
      await queryClient.invalidateQueries({ queryKey: ["prayers"] });
    },
  });

  const prayMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}/pray`, {
        method: "POST",
      });
      if (!response.ok) {
        let message = "Failed to update prayer";
        try {
          const data = (await response.json()) as { error?: string };
          if (data?.error) message = data.error;
        } catch {
          // ignore JSON parse errors
        }
        if (response.status === 401) {
          signIn("google");
        }
        throw new Error(message);
      }
      return (await response.json()) as { count: number };
    },
    onMutate: async () => {
      if (hasPrayed) return { previousCount: count, previousHasPrayed: hasPrayed };

      setHasPrayed(true);
      setCount((prev) => prev + 1);
      return { previousCount: count, previousHasPrayed: hasPrayed };
    },
    onError: (_error, _variables, context) => {
      if (context) {
        setHasPrayed(context.previousHasPrayed);
        setCount(context.previousCount);
      }
    },
    onSuccess: (data) => {
      setCount(data.count);
      setHasPrayed(true);
    },
  });

  const handlePray = async () => {
    if (!session?.user?.id) return;

    setIsPending(true);

    try {
      await prayMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  const toggleComments = () => {
    setShowComments((prev) => !prev);
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    if (!commentText.trim()) return;

    commentMutation.mutate();
  };

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditStart = () => {
    setEditText(content);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText(content);
  };

  const handleEditSave = async () => {
    if (!editText.trim()) return;
    try {
      await editMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <article className="wall-card flex gap-4 rounded-none">
      <div className="avatar-ring">
        <div className="avatar-core">
          {prayer.isAnonymous
            ? "A"
            : (prayer.user?.name?.[0] ?? "U").toUpperCase()}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            {prayer.isAnonymous ? (
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                Anonymous
              </p>
            ) : (
              <a
                href={
                  prayer.user?.username
                    ? `/profile/${prayer.user.username}`
                    : "/profile"
                }
                className="text-sm font-semibold text-[color:var(--ink)] hover:underline"
              >
                {prayer.user?.name ?? "User"}
              </a>
            )}
            <p className="text-xs text-[color:var(--subtle)]">
              {new Date(prayer.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="meta-pill">
              <span>Prayed</span>
              <span className="font-semibold text-[color:var(--ink)]">
                {count}
              </span>
            </div>
            {isOwner && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:bg-[color:var(--surface-strong)]"
                  aria-label="More actions"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="mx-auto h-4 w-4"
                    fill="currentColor"
                  >
                    <circle cx="6" cy="12" r="1.7" />
                    <circle cx="12" cy="12" r="1.7" />
                    <circle cx="18" cy="12" r="1.7" />
                  </svg>
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 z-10 min-w-[260px] rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-4 shadow-xl transition-all duration-200 ease-out">
                    <button
                      type="button"
                      onClick={handleEditStart}
                      className="mb-2 w-full rounded-2xl px-5 py-4 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Edit Prayer
                    </button>
                    <button
                      type="button"
                      onClick={handleDelete}
                      className="w-full rounded-2xl px-5 py-4 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Delete Prayer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditing ? (
          <div className="mt-4 flex flex-col gap-3">
            <textarea
              className="soft-input min-h-[100px] text-sm"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                className="pill-button bg-[color:var(--accent)] text-white hover:bg-[color:var(--accent-strong)] cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                className="pill-button bg-[color:var(--surface-strong)] text-[color:var(--ink)] hover:bg-[color:var(--surface)] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink)]">
            {content}
          </p>
        )}
        <div className="mt-4 flex items-center gap-3">
          {!isOwner && (
            <button
              type="button"
              onClick={handlePray}
              disabled={!session?.user?.id || isPending || hasPrayed}
              className="pill-button bg-[color:var(--surface-strong)] text-[color:var(--ink)] hover:bg-[color:var(--surface)] disabled:opacity-50"
            >
              {hasPrayed ? "Prayed" : "Pray"}
            </button>
          )}
          <button
            type="button"
            onClick={toggleComments}
            className="pill-button bg-[color:var(--surface-strong)] text-[color:var(--ink)] hover:bg-[color:var(--surface)]"
          >
            Comments · {commentCount}
          </button>
          <span className="text-xs text-[color:var(--subtle)]">
            Lift this prayer up.
          </span>
        </div>

        {showComments && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
              <textarea
                className="soft-input min-h-[90px] text-sm"
                placeholder="Write a comment..."
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="pill-button bg-[color:var(--accent)] text-white"
                >
                  Post comment
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-col gap-3 text-sm">
              {isLoadingComments ? (
                <div className="flex flex-col gap-3">
                  {Array.from({ length: 2 }).map((_, index) => (
                    <div key={index} className="flex gap-3">
                      <div className="h-9 w-9 rounded-full bg-slate-200 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-3 w-24 bg-slate-200 rounded-full animate-pulse" />
                        <div className="mt-2 h-3 w-full bg-slate-200 rounded-full animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : comments.length === 0 ? (
                <div className="text-[color:var(--subtle)]">No comments yet.</div>
              ) : (
                comments.map((comment) => (
                  <div key={comment._id} className="flex gap-3">
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {(comment.userId?.name?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[color:var(--ink)]">
                          {comment.userId?.name ?? "User"}
                        </p>
                        <p className="text-xs text-[color:var(--subtle)]">
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <p className="mt-1 text-sm text-[color:var(--ink)]">
                        {comment.content}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </article>
  );
}
