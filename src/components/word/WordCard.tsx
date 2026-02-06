"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type WordUser = {
  name?: string | null;
  username?: string | null;
};

type Word = {
  _id: string;
  content: string;
  createdAt: string;
  likedBy?: string[];
  commentCount?: number;
  user?: WordUser | null;
};

type WordComment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: { name?: string | null } | null;
};

type WordCardProps = {
  word: Word;
};

export default function WordCard({ word }: WordCardProps) {
  const { data: session } = useSession();
  const [likeCount, setLikeCount] = useState(word.likedBy?.length ?? 0);
  const [commentCount, setCommentCount] = useState(word.commentCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<WordComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [isLiking, setIsLiking] = useState(false);

  const loadComments = async () => {
    setIsLoadingComments(true);
    try {
      const response = await fetch(`/api/words/${word._id}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      const data = (await response.json()) as WordComment[];
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

  const handleLike = async () => {
    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    setIsLiking(true);
    try {
      const response = await fetch(`/api/words/${word._id}/like`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to like word");
      }
      const data = (await response.json()) as { count: number };
      setLikeCount(data.count);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    if (!commentText.trim()) return;

    try {
      const response = await fetch("/api/word-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId: word._id, content: commentText.trim() }),
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
          {(word.user?.name?.[0] ?? "W").toUpperCase()}
        </div>
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[color:var(--ink)]">
              {word.user?.name ?? "User"}
            </p>
            <p className="text-xs text-[color:var(--subtle)]">
              {word.user?.username ? `@${word.user.username}` : ""}
            </p>
          </div>
          <p className="text-xs text-[color:var(--subtle)]">
            {new Date(word.createdAt).toLocaleString()}
          </p>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-[color:var(--ink)]">
          {word.content}
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            className="pill-button border border-slate-200 text-[color:var(--ink)] cursor-pointer"
          >
            Pray · {likeCount}
          </button>
          <button
            type="button"
            onClick={toggleComments}
            className="pill-button border border-slate-200 text-[color:var(--ink)] cursor-pointer"
          >
            Comments · {commentCount}
          </button>
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
                  className="pill-button bg-[color:var(--accent)] text-white cursor-pointer"
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
