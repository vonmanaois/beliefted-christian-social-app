"use client";

import { signIn, useSession } from "next-auth/react";
import { useState } from "react";

export type PrayerUser = {
  name?: string | null;
  image?: string | null;
};

export type Prayer = {
  _id: string;
  content: string;
  createdAt: string;
  isAnonymous: boolean;
  prayedBy: string[];
  commentCount?: number;
  user?: PrayerUser | null;
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
  const [count, setCount] = useState(prayer.prayedBy.length);
  const [isPending, setIsPending] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commentCount, setCommentCount] = useState(prayer.commentCount ?? 0);

  const handlePray = async () => {
    if (!session?.user?.id) return;

    setIsPending(true);

    try {
      const response = await fetch(`/api/prayers/${prayer._id}/pray`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to update prayer");
      }

      const data = (await response.json()) as { count: number };
      setCount(data.count);
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  };

  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/prayers/${prayer._id}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      const data = (await response.json()) as Comment[];
      setComments(data);
      setCommentCount(data.length);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingComments(false);
    }
  };

  const toggleComments = async () => {
    if (!showComments) {
      await loadComments();
    }
    setShowComments((prev) => !prev);
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    if (!commentText.trim()) return;

    try {
      const response = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prayerId: prayer._id,
          content: commentText.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post comment");
      }

      setCommentText("");
      await loadComments();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <article className="wall-card flex gap-4">
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
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {prayer.isAnonymous ? "Anonymous" : prayer.user?.name ?? "User"}
            </p>
            <p className="text-xs text-[color:var(--subtle)]">
              {new Date(prayer.createdAt).toLocaleString()}
            </p>
          </div>
          <div className="meta-pill">
            <span>Prayed</span>
            <span className="font-semibold text-[color:var(--ink)]">
              {count}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink)]">
          {prayer.content}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handlePray}
            disabled={!session?.user?.id || isPending}
            className="pill-button border border-slate-200 text-slate-700 disabled:opacity-50"
          >
            Pray
          </button>
          <button
            type="button"
            onClick={toggleComments}
            className="pill-button border border-slate-200 text-[color:var(--ink)]"
          >
            Comments · {commentCount}
          </button>
          <span className="text-xs text-[color:var(--subtle)]">
            Lift this prayer up.
          </span>
        </div>

        {showComments && (
          <div className="mt-5 border-t border-slate-100 pt-4">
            <form
              onSubmit={handleCommentSubmit}
              className="flex flex-col gap-3"
            >
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
                <div className="text-[color:var(--subtle)]">
                  Loading comments...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-[color:var(--subtle)]">
                  No comments yet.
                </div>
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
