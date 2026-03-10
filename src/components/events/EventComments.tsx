"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import Avatar from "@/components/ui/Avatar";
import MentionTextarea from "@/components/ui/MentionTextarea";

type CommentUser = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

type EventComment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
  parentId?: string | null;
  isHostReply?: boolean;
};

type EventCommentsProps = {
  eventId: string;
  isHost?: boolean;
};

const formatTime = (timestamp: string) => {
  const createdAt = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - createdAt.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));
  if (diffMinutes < 1) return "just now";
  if (diffMinutes < 60) return `${diffMinutes}min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;
  return createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

export default function EventComments({ eventId, isHost = false }: EventCommentsProps) {
  const { status, data: session } = useSession();
  const isAuthenticated = status === "authenticated";
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const replyInputRef = useRef<HTMLTextAreaElement | null>(null);

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["event-comments", eventId],
    queryFn: async () => {
      const response = await fetch(`/api/events/${eventId}/comments`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as EventComment[];
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/event-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, content: commentText.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("open-signin"));
        }
        throw new Error("Failed to post comment");
      }
      return (await response.json()) as EventComment;
    },
    onSuccess: (newComment) => {
      setCommentError(null);
      setCommentText("");
      const hydrated =
        session?.user?.id && (!newComment.userId || typeof newComment.userId === "string")
          ? {
              ...newComment,
              parentId: newComment.parentId ? String(newComment.parentId) : null,
              userId: {
                _id: session.user.id,
                name: session.user.name ?? "User",
                image: session.user.image ?? null,
                username: (session.user as { username?: string | null })?.username ?? null,
              },
            }
          : newComment;
      queryClient.setQueryData<EventComment[]>(
        ["event-comments", eventId],
        (current = []) => [hydrated as EventComment, ...current]
      );
    },
    onError: () => {
      setCommentError("Couldn't post comment.");
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ parentId, content }: { parentId: string; content: string }) => {
      const response = await fetch("/api/event-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, content, parentId }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("open-signin"));
        }
        throw new Error("Failed to post reply");
      }
      return (await response.json()) as EventComment;
    },
    onSuccess: (newComment) => {
      setCommentError(null);
      setReplyText("");
      setReplyingTo(null);
      const hydrated =
        session?.user?.id && (!newComment.userId || typeof newComment.userId === "string")
          ? {
              ...newComment,
              parentId: newComment.parentId ? String(newComment.parentId) : null,
              userId: {
                _id: session.user.id,
                name: session.user.name ?? "User",
                image: session.user.image ?? null,
                username: (session.user as { username?: string | null })?.username ?? null,
              },
            }
          : newComment;
      queryClient.setQueryData<EventComment[]>(
        ["event-comments", eventId],
        (current = []) => [hydrated as EventComment, ...current]
      );
    },
    onError: () => {
      setCommentError("Couldn't post reply.");
    },
  });

  const topLevelComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = comments.reduce<Record<string, EventComment[]>>((acc, comment) => {
    if (!comment.parentId) return acc;
    if (!acc[comment.parentId]) {
      acc[comment.parentId] = [];
    }
    acc[comment.parentId].push(comment);
    return acc;
  }, {});
  Object.values(repliesByParent).forEach((items) =>
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  return (
    <div className="panel p-4">
      <h2 className="text-sm font-semibold text-[color:var(--ink)]">Event comments</h2>
      {isAuthenticated && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!commentText.trim()) return;
            commentMutation.mutate();
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <MentionTextarea
            value={commentText}
            onChangeValue={setCommentText}
            placeholder="Ask a question or leave a note..."
            className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full px-3 py-2"
            textareaRef={inputRef}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="post-button px-4 py-2"
              disabled={!commentText.trim() || commentMutation.isPending}
            >
              Post comment
            </button>
          </div>
        </form>
      )}
      {commentError ? (
        <p className="mt-2 text-xs text-[color:var(--subtle)]">{commentError}</p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 text-sm">
        {isLoading ? (
          <p className="text-xs text-[color:var(--subtle)]">Loading comments...</p>
        ) : topLevelComments.length === 0 ? (
          <p className="text-xs text-[color:var(--subtle)]">Be the first to comment.</p>
        ) : (
          topLevelComments.map((comment) => {
            const replies = repliesByParent[comment._id] ?? [];
            return (
              <div key={comment._id} className="flex flex-col gap-2">
                <div className="flex gap-3">
                  <Avatar
                    src={comment.userId?.image ?? null}
                    alt={comment.userId?.name ?? "User"}
                    size={36}
                    href={
                      comment.userId?.username
                        ? `/profile/${comment.userId.username}`
                        : "/profile"
                    }
                    fallback={(comment.userId?.name?.[0] ?? "U").toUpperCase()}
                    className="h-8 w-8 sm:h-9 sm:w-9 text-[11px] sm:text-xs cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
                      <span className="font-semibold text-[color:var(--ink)]">
                        {comment.userId?.name ?? "User"}
                      </span>
                      {comment.userId?.username && <span>@{comment.userId.username}</span>}
                      <span>{formatTime(comment.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[color:var(--ink)] whitespace-pre-line">
                      {comment.content}
                    </p>
                    {isHost ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isAuthenticated) {
                            window.dispatchEvent(new Event("open-signin"));
                            return;
                          }
                          setReplyingTo(comment._id);
                          setReplyText("");
                          setTimeout(() => replyInputRef.current?.focus(), 0);
                        }}
                        className="mt-2 text-xs font-semibold text-[color:var(--accent)]"
                      >
                        Reply as host
                      </button>
                    ) : null}
                  </div>
                </div>
                {replyingTo === comment._id ? (
                  <div className="ml-11 rounded-xl border border-[color:var(--panel-border)] bg-white/40 p-3">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (!replyText.trim()) return;
                        replyMutation.mutate({
                          parentId: comment._id,
                          content: replyText.trim(),
                        });
                      }}
                      className="flex flex-col gap-2"
                    >
                      <MentionTextarea
                        value={replyText}
                        onChangeValue={setReplyText}
                        placeholder="Reply as the host..."
                        className="bg-transparent comment-input min-h-[24px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full"
                        textareaRef={replyInputRef}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyText("");
                          }}
                          className="rounded-full border border-[color:var(--panel-border)] px-3 py-1 text-xs font-semibold text-[color:var(--subtle)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1 text-xs font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                          disabled={!replyText.trim() || replyMutation.isPending}
                        >
                          Send reply
                        </button>
                      </div>
                    </form>
                  </div>
                ) : null}
                {replies.length ? (
                  <div className="relative ml-11 flex flex-col gap-2 pl-6">
                    <span className="absolute left-2 top-0 bottom-0 w-[2px] bg-[color:var(--panel-border)]" />
                    {replies.map((reply) => (
                      <div key={reply._id} className="relative">
                        <span className="absolute left-2 top-5 h-[2px] w-6 bg-[color:var(--panel-border)]" />
                        <div className="flex gap-3 rounded-xl bg-white/70 px-3 py-2 shadow-[0_1px_0_rgba(0,0,0,0.04)]">
                          <Avatar
                            src={reply.userId?.image ?? null}
                            alt={reply.userId?.name ?? "Host"}
                            size={32}
                            href={
                              reply.userId?.username
                                ? `/profile/${reply.userId.username}`
                                : "/profile"
                            }
                            fallback={(reply.userId?.name?.[0] ?? "H").toUpperCase()}
                            className="h-7 w-7 text-[10px] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
                              <span className="font-semibold text-[color:var(--ink)]">
                                {reply.userId?.name ?? "Host"}
                              </span>
                              {reply.userId?.username && <span>@{reply.userId.username}</span>}
                              {reply.isHostReply ? (
                                <span className="rounded-full border border-[color:var(--panel-border)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--subtle)]">
                                  Host
                                </span>
                              ) : null}
                              <span>{formatTime(reply.createdAt)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--subtle)]">
                              <span className="h-[1px] w-5 bg-[color:var(--panel-border)]" />
                              <span>Replying to this comment</span>
                            </div>
                            <p className="mt-1 text-sm text-[color:var(--ink)] whitespace-pre-line">
                              {reply.content}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
