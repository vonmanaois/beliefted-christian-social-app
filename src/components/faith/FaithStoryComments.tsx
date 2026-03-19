"use client";

import { memo } from "react";
import Link from "next/link";
import { DotsThreeOutline, Heart } from "@phosphor-icons/react";
import Avatar from "@/components/ui/Avatar";
import MentionText from "@/components/ui/MentionText";
import MentionTextarea from "@/components/ui/MentionTextarea";

export type FaithCommentData = {
  _id: string;
  content: string;
  createdAt: string;
  parentId?: string | null;
  likedBy?: string[];
  userId?: {
    _id?: string | null;
    name?: string | null;
    image?: string | null;
    username?: string | null;
  } | null;
};

type FaithStoryCommentsProps = {
  sessionUserId: string | null;
  commentText: string;
  onCommentTextChange: (next: string) => void;
  onSubmit: (event?: React.FormEvent) => void;
  replyingToId: string | null;
  replyText: string;
  onReplyTextChange: (next: string) => void;
  onStartReply: (comment: FaithCommentData) => void;
  onCancelReply: () => void;
  onSubmitReply: (parentId: string) => void;
  replyInputRef: React.RefObject<HTMLTextAreaElement | null>;
  comments: FaithCommentData[];
  isLoading: boolean;
  editingCommentId: string | null;
  editingCommentText: string;
  onEditingCommentTextChange: (next: string) => void;
  onStartEdit: (comment: FaithCommentData) => void;
  onCancelEdit: () => void;
  onSaveEdit: (id: string, content: string) => void;
  onRequestDelete: (id: string) => void;
  commentEditRef: React.RefObject<HTMLDivElement | null>;
  commentMenuId: string | null;
  onToggleCommentMenu: (next: string | null) => void;
  onToggleLike: (id: string) => void;
  formatPostTime: (timestamp: string) => string;
};

const FaithStoryComments = memo(function FaithStoryComments({
  sessionUserId,
  commentText,
  onCommentTextChange,
  onSubmit,
  replyingToId,
  replyText,
  onReplyTextChange,
  onStartReply,
  onCancelReply,
  onSubmitReply,
  replyInputRef,
  comments,
  isLoading,
  editingCommentId,
  editingCommentText,
  onEditingCommentTextChange,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onRequestDelete,
  commentEditRef,
  commentMenuId,
  onToggleCommentMenu,
  onToggleLike,
  formatPostTime,
}: FaithStoryCommentsProps) {
  const topLevelComments = comments.filter((comment) => !comment.parentId);
  const repliesByParent = comments.reduce<Record<string, FaithCommentData[]>>((acc, comment) => {
    if (!comment.parentId) return acc;
    if (!acc[comment.parentId]) acc[comment.parentId] = [];
    acc[comment.parentId].push(comment);
    return acc;
  }, {});
  Object.values(repliesByParent).forEach((items) =>
    items.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  );

  return (
    <div className="flex flex-col gap-3 text-[13px] sm:text-sm">
      {sessionUserId && (
        <form onSubmit={onSubmit} className="flex flex-col gap-2">
          <MentionTextarea
            value={commentText}
            onChangeValue={onCommentTextChange}
            placeholder="Write a comment..."
            className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full"
          />
          <div className="flex justify-end">
            <button type="submit" className="post-button" disabled={!commentText.trim()}>
              Post comment
            </button>
          </div>
        </form>
      )}

      {isLoading ? (
        <div className="text-[color:var(--subtle)]">Loading comments...</div>
      ) : topLevelComments.length === 0 ? (
        <div className="text-[color:var(--subtle)]">No comments yet.</div>
      ) : (
        topLevelComments.map((comment, index) => {
          const commentOwnerId = comment.userId?._id ? String(comment.userId._id) : null;
          const isCommentOwner = Boolean(sessionUserId && commentOwnerId === sessionUserId);
          const commentHasLiked = Boolean(
            sessionUserId && (comment.likedBy ?? []).includes(sessionUserId)
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
                  href={comment.userId?.username ? `/profile/${comment.userId.username}` : "/profile"}
                  fallback={(comment.userId?.name?.[0] ?? "U").toUpperCase()}
                  className="h-8 w-8 text-[11px] cursor-pointer"
                />
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="comment-meta-row">
                      <Link
                        href={comment.userId?.username ? `/profile/${comment.userId.username}` : "/profile"}
                        prefetch={false}
                        className="comment-author-link cursor-pointer"
                      >
                        {comment.userId?.name ?? "User"}
                      </Link>
                      {comment.userId?.username && (
                        <span className="comment-handle">
                          @{comment.userId.username}
                        </span>
                      )}
                      <span className="comment-timestamp">
                        {formatPostTime(comment.createdAt)}
                      </span>
                    </div>
                    {isCommentOwner && (
                      <div className="relative" data-comment-menu>
                        <button
                          type="button"
                          onClick={() =>
                            onToggleCommentMenu(commentMenuId === comment._id ? null : comment._id)
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
                    <p className="comment-body-copy mt-1">
                      <MentionText text={comment.content} />
                    </p>
                  )}
                  {sessionUserId && (
                    <div className="comment-action-row mt-2">
                      <button
                        type="button"
                        onClick={() => onStartReply(comment)}
                        className="comment-action-button text-[color:var(--accent)]"
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLike(comment._id)}
                        className={`comment-action-button ${
                          commentHasLiked ? "text-[color:var(--accent)]" : "text-[color:var(--subtle)]"
                        }`}
                      >
                        <Heart size={14} weight={commentHasLiked ? "fill" : "regular"} />
                        <span>{comment.likedBy?.length ?? 0}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {replyingToId === comment._id ? (
                <div className="reply-shell ml-11 px-3 py-2">
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
                  {replies.map((reply) => {
                    const replyHasLiked = Boolean(
                      sessionUserId && (reply.likedBy ?? []).includes(sessionUserId)
                    );
                    return (
                      <div key={reply._id} className="relative">
                        <span className="absolute left-2 top-5 h-[2px] w-6 bg-[color:var(--panel-border)]" />
                        <div className="reply-shell flex gap-3 px-3 py-2">
                          <Avatar
                            src={reply.userId?.image ?? null}
                            alt={reply.userId?.name ?? "User"}
                            size={32}
                            href={reply.userId?.username ? `/profile/${reply.userId.username}` : "/profile"}
                            fallback={(reply.userId?.name?.[0] ?? "U").toUpperCase()}
                            className="h-7 w-7 text-[10px] cursor-pointer"
                          />
                          <div className="flex-1">
                            <div className="comment-meta-row">
                              <span className="comment-author-link">
                                {reply.userId?.name ?? "User"}
                              </span>
                              {reply.userId?.username && (
                                <span className="comment-handle">@{reply.userId.username}</span>
                              )}
                              <span className="comment-timestamp">{formatPostTime(reply.createdAt)}</span>
                            </div>
                            <div className="reply-context-copy mt-1">
                              <span className="h-[1px] w-5 bg-[color:var(--panel-border)]" />
                              <span>
                                Replying to{" "}
                                {comment.userId?.username ? `@${comment.userId.username}` : "this comment"}
                              </span>
                            </div>
                            <p className="comment-body-copy mt-1">
                              <MentionText text={reply.content} />
                            </p>
                            {sessionUserId && (
                              <button
                                type="button"
                                onClick={() => onToggleLike(reply._id)}
                                className={`comment-action-button mt-2 ${
                                  replyHasLiked ? "text-[color:var(--accent)]" : "text-[color:var(--subtle)]"
                                }`}
                              >
                                <Heart size={14} weight={replyHasLiked ? "fill" : "regular"} />
                                <span>{reply.likedBy?.length ?? 0}</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })
      )}
    </div>
  );
});

export default FaithStoryComments;
