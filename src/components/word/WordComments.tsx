"use client";

import { memo } from "react";
import Link from "next/link";
import { DotsThreeOutline } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import MentionText from "@/components/ui/MentionText";
import MentionTextarea from "@/components/ui/MentionTextarea";
import type { WordCommentData } from "@/components/word/types";

type WordCommentsProps = {
  sessionUserId: string | null;
  commentText: string;
  onCommentTextChange: (next: string) => void;
  commentInputRef: React.RefObject<HTMLTextAreaElement | null>;
  commentFormRef: React.RefObject<HTMLDivElement | null>;
  onSubmit: (event?: React.FormEvent) => void;
  replyingToId: string | null;
  replyText: string;
  onReplyTextChange: (next: string) => void;
  onStartReply: (comment: WordCommentData) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: string) => void;
  replyInputRef: React.RefObject<HTMLTextAreaElement | null>;
  onRetrySubmit: () => void;
  commentError: string | null;
  isLoading: boolean;
  comments: WordCommentData[];
  commentMenuId: string | null;
  onToggleCommentMenu: (next: string | null) => void;
  editingCommentId: string | null;
  editingCommentText: string;
  onEditingCommentTextChange: (next: string) => void;
  onStartEdit: (comment: WordCommentData) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string) => void;
  onRequestDelete: (id: string) => void;
  commentEditRef: React.RefObject<HTMLDivElement | null>;
  formatPostTime: (timestamp: string) => string;
};

const WordComments = memo(function WordComments({
  sessionUserId,
  commentText,
  onCommentTextChange,
  commentInputRef,
  commentFormRef,
  onSubmit,
  replyingToId,
  replyText,
  onReplyTextChange,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  replyInputRef,
  onRetrySubmit,
  commentError,
  isLoading,
  comments,
  commentMenuId,
  onToggleCommentMenu,
  editingCommentId,
  editingCommentText,
  onEditingCommentTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  commentEditRef,
  formatPostTime,
}: WordCommentsProps) {
  const topLevelComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = comments.reduce<Record<string, WordCommentData[]>>((acc, comment) => {
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
    <div
      className="mt-3 border-t border-slate-100 pt-3 pb-10 mb-2 bg-[color:var(--surface-strong)]/10 rounded-b-2xl shadow-[0_10px_24px_-20px_rgba(0,0,0,0.45)] relative overflow-visible"
      ref={commentFormRef}
    >
      {sessionUserId && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2 px-3 sm:px-4">
          <MentionTextarea
            value={commentText}
            onChangeValue={onCommentTextChange}
            placeholder="Share a reflection..."
            className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full px-3 py-2"
            textareaRef={commentInputRef}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="post-button px-4 py-2"
              disabled={!commentText.trim()}
            >
              Post reflection
            </button>
          </div>
        </form>
      )}
      {commentError && (
        <div className="mt-2 text-[11px] text-[color:var(--subtle)] flex items-center gap-2">
          <span>{commentError}</span>
          <button
            type="button"
            onClick={onRetrySubmit}
            className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 px-3 sm:px-4 text-[13px] sm:text-sm">
        {isLoading ? (
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
        ) : topLevelComments.length === 0 ? (
          <div className="text-[color:var(--subtle)] text-[13px] sm:text-sm">
            Be the first to reflect.
          </div>
        ) : (
          topLevelComments.map((comment, index) => {
            const commentOwnerId = comment.userId?._id
              ? String(comment.userId._id)
              : null;
            const isCommentOwner = Boolean(
              sessionUserId && commentOwnerId === sessionUserId
            );
            const replies = repliesByParent[comment._id] ?? [];

            return (
              <div key={comment._id} className="flex flex-col gap-2">
                <div
                  className={`flex gap-3 pt-3 ${
                    index === 0 ? "" : "border-t border-[color:var(--panel-border)]"
                  }`}
                >
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
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={
                            comment.userId?.username
                              ? `/profile/${comment.userId.username}`
                              : "/profile"
                          }
                          prefetch={false}
                          className="text-[11px] sm:text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:underline"
                        >
                          {comment.userId?.name ?? "User"}
                        </Link>
                        {comment.userId?.username && (
                          <span className="text-[11px] sm:text-xs text-[color:var(--subtle)]">
                            @{comment.userId.username}
                          </span>
                        )}
                        <p className="text-[11px] sm:text-xs text-[color:var(--subtle)]">
                          {formatPostTime(comment.createdAt)}
                        </p>
                      </div>
                      {isCommentOwner && (
                        <div className="relative" data-comment-menu>
                          <button
                            type="button"
                            onClick={() =>
                              onToggleCommentMenu(
                                commentMenuId === comment._id ? null : comment._id
                              )
                            }
                            className="h-7 w-7 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                            aria-label="Comment actions"
                          >
                            <DotsThreeOutline size={16} weight="regular" />
                          </button>
                          {commentMenuId === comment._id && (
                            <div className="absolute right-0 top-8 z-10 min-w-[160px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
                              <button
                                type="button"
                                onClick={() => onStartEdit(comment)}
                                className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => onRequestDelete(comment._id)}
                                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                              >
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment._id ? (
                      <div ref={commentEditRef} className="mt-2 flex flex-col gap-2">
                        <MentionTextarea
                          value={editingCommentText}
                          onChangeValue={onEditingCommentTextChange}
                          className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSaveEdit(comment._id, editingCommentText)}
                            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] cursor-pointer"
                            disabled={!editingCommentText.trim()}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEdit}
                            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-[13px] sm:text-sm text-[color:var(--ink)]">
                        <MentionText text={comment.content} />
                      </p>
                    )}
                    {sessionUserId && (
                      <button
                        type="button"
                        onClick={() => onStartReply(comment)}
                        className="mt-2 text-[11px] sm:text-xs font-semibold text-[color:var(--accent)]"
                      >
                        Reply
                      </button>
                    )}
                  </div>
                </div>
                {replyingToId === comment._id ? (
                  <div className="ml-11 rounded-xl border border-[color:var(--panel-border)] bg-white/40 px-3 py-2">
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        onSubmitReply(comment._id);
                      }}
                      className="flex flex-col gap-2"
                    >
                      <MentionTextarea
                        value={replyText}
                        onChangeValue={onReplyTextChange}
                        placeholder="Reply..."
                        className="bg-transparent comment-input min-h-[24px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full"
                        textareaRef={replyInputRef}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={onCancelReply}
                          className="rounded-full border border-[color:var(--panel-border)] px-3 py-1 text-[11px] font-semibold text-[color:var(--subtle)]"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="rounded-full px-3 py-1 text-[11px] font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                          disabled={!replyText.trim()}
                        >
                          Reply
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
                            alt={reply.userId?.name ?? "User"}
                            size={32}
                            href={
                              reply.userId?.username
                                ? `/profile/${reply.userId.username}`
                                : "/profile"
                            }
                            fallback={(reply.userId?.name?.[0] ?? "U").toUpperCase()}
                            className="h-7 w-7 text-[10px] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 text-[11px] text-[color:var(--subtle)]">
                              <span className="font-semibold text-[color:var(--ink)]">
                                {reply.userId?.name ?? "User"}
                              </span>
                              {reply.userId?.username && <span>@{reply.userId.username}</span>}
                              <span>{formatPostTime(reply.createdAt)}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-[color:var(--subtle)]">
                              <span className="h-[1px] w-5 bg-[color:var(--panel-border)]" />
                              <span>
                                Replying to{" "}
                                {comment.userId?.username
                                  ? `@${comment.userId.username}`
                                  : "this comment"}
                              </span>
                            </div>
                            <p className="mt-1 text-[13px] sm:text-sm text-[color:var(--ink)]">
                              <MentionText text={reply.content} />
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
});

export default WordComments;
