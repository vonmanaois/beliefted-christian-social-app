"use client";

import { useEffect, useRef, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircle, DotsThreeOutline, Heart } from "@phosphor-icons/react";
import Image from "next/image";
import Modal from "@/components/layout/Modal";

type WordUser = {
  name?: string | null;
  username?: string | null;
};

type Word = {
  _id: string | { $oid?: string };
  content: string;
  createdAt: string;
  likedBy?: string[];
  commentCount?: number;
  user?: WordUser | null;
  userId?: string | null;
  isOwner?: boolean;
};

type WordComment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: { _id?: string | null; name?: string | null } | null;
};

type WordCardProps = {
  word: Word;
};

const formatPostTime = (timestamp: string) => {
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

export default function WordCard({ word }: WordCardProps) {
  const { data: session } = useSession();
  const queryClient = useQueryClient();
  const normalizeId = (raw: Word["_id"]) => {
    if (typeof raw === "string") {
      return raw.replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
    }
    const asObj = raw as { $oid?: string; toString?: () => string };
    if (asObj?.$oid) return asObj.$oid;
    if (asObj?.toString) return asObj.toString().replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
    return String(raw);
  };
  const wordId = normalizeId(word._id);
  const [likeCount, setLikeCount] = useState(word.likedBy?.length ?? 0);
  const [hasLiked, setHasLiked] = useState(
    session?.user?.id ? word.likedBy?.includes(String(session.user.id)) ?? false : false
  );
  const [likeBurst, setLikeBurst] = useState(false);
  const [commentCount, setCommentCount] = useState(word.commentCount ?? 0);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentOriginal, setEditingCommentOriginal] = useState("");
  const [showCommentEditConfirm, setShowCommentEditConfirm] = useState(false);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const commentEditRef = useRef<HTMLDivElement | null>(null);
  const commentFormRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const commentButtonRef = useRef<HTMLButtonElement | null>(null);
  const [isLiking, setIsLiking] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showCommentConfirm, setShowCommentConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(word.content);
  const [editText, setEditText] = useState(word.content);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const isOwner =
    word.isOwner ??
    Boolean(
      session?.user?.id &&
        word.userId &&
        String(word.userId) === String(session.user.id)
    );

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["word-comments", wordId],
    queryFn: async () => {
      const response = await fetch(`/api/words/${wordId}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as WordComment[];
    },
    enabled: showComments,
  });

  useEffect(() => {
    if (showComments && !isLoadingComments) {
      setCommentCount(comments.length);
    }
  }, [comments.length, showComments, isLoadingComments]);

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!commentMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-comment-menu]")) return;
      setCommentMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [commentMenuId]);

  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!editRef.current) return;
      if (editRef.current.contains(event.target as Node)) return;
      if (editText.trim() !== content.trim()) {
        setShowEditConfirm(true);
      } else {
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, editText, content]);

  useEffect(() => {
    if (!editingCommentId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!commentEditRef.current) return;
      if (commentEditRef.current.contains(event.target as Node)) return;
      if (editingCommentText.trim() !== editingCommentOriginal.trim()) {
        setShowCommentEditConfirm(true);
      } else {
        setEditingCommentId(null);
        setEditingCommentText("");
        setEditingCommentOriginal("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCommentId, editingCommentText, editingCommentOriginal]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/words/${wordId}/like`, {
        method: "POST",
      });
      if (!response.ok) {
        let message = "Failed to like word";
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
      if (!session?.user?.id) return;
      setLikeBurst(true);
      setTimeout(() => setLikeBurst(false), 180);
      setHasLiked((prev) => !prev);
      setLikeCount((prev) => (hasLiked ? Math.max(0, prev - 1) : prev + 1));
    },
    onError: () => {
      setHasLiked((prev) => !prev);
      setLikeCount((prev) => (hasLiked ? prev + 1 : Math.max(0, prev - 1)));
    },
    onSuccess: (data) => {
      setLikeCount(data.count ?? 0);
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/word-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, content: commentText.trim() }),
      });
      if (!response.ok) {
        throw new Error("Failed to post comment");
      }
    },
    onSuccess: async () => {
      setCommentText("");
      await queryClient.invalidateQueries({
        queryKey: ["word-comments", wordId],
      });
    },
  });

  const commentEditMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await fetch(`/api/word-comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error("Failed to update comment");
      }
    },
    onSuccess: async () => {
      setEditingCommentId(null);
      setEditingCommentText("");
      await queryClient.invalidateQueries({
        queryKey: ["word-comments", wordId],
      });
    },
  });

  const commentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/word-comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["word-comments", wordId],
      });
    },
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/words/${wordId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editText.trim() }),
      });
      if (!response.ok) {
        let message = "Failed to update post";
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
      await queryClient.invalidateQueries({ queryKey: ["words"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/words/${wordId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        let message = "Failed to delete post";
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
      await queryClient.invalidateQueries({ queryKey: ["words"] });
    },
  });

  const toggleComments = () => {
    setShowComments((prev) => {
      if (prev) {
        if (commentText.trim().length > 0) {
          setShowCommentConfirm(true);
          return prev;
        }
        setCommentText("");
        return false;
      }
      setTimeout(() => commentInputRef.current?.focus(), 0);
      return true;
    });
  };

  const handleLike = async () => {
    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    setIsLiking(true);
    try {
      await likeMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLiking(false);
    }
  };

  useEffect(() => {
    if (!session?.user?.id) return;
    if (word.likedBy?.includes(String(session.user.id))) {
      setHasLiked(true);
    }
  }, [word.likedBy, session?.user?.id]);

  const handleCommentSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    if (!commentText.trim()) return;

    commentMutation.mutate();
  };

  useEffect(() => {
    if (!showComments) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!commentFormRef.current) return;
      if (commentButtonRef.current?.contains(event.target as Node)) {
        return;
      }
      if (commentFormRef.current.contains(event.target as Node)) return;
      if (commentText.trim().length > 0) {
        setShowCommentConfirm(true);
      } else {
        setShowComments(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showComments, commentText]);

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

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <article className="wall-card flex gap-4 rounded-none">
      <div className="avatar-ring">
        <div className="avatar-core">
          {word.user?.image ? (
            <Image
              src={word.user.image}
              alt={word.user?.name ?? "User"}
              width={48}
              height={48}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            (word.user?.name?.[0] ?? "W").toUpperCase()
          )}
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
          <div className="flex items-center gap-2">
            <p className="text-xs text-[color:var(--subtle)]">
              {formatPostTime(word.createdAt)}
            </p>
            {isOwner && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                  aria-label="More actions"
                >
                  <DotsThreeOutline size={20} weight="regular" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 z-10 min-w-[200px] rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
                    <button
                      type="button"
                      onClick={handleEditStart}
                      className="mb-1 w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Edit Post
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Delete Post
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditing ? (
          <div ref={editRef} className="mt-4 flex flex-col gap-3">
            <textarea
              className="soft-input min-h-[100px] text-sm"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-white cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
              >
                Save
              </button>
              <button
                type="button"
                onClick={handleEditCancel}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer pointer-events-auto hover:text-[color:var(--accent)] active:translate-y-[1px]"
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
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            className={`pill-button cursor-pointer transition-colors ${
              hasLiked
                ? "text-[color:var(--accent-strong)]"
                : "text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <Heart
                size={22}
                weight={hasLiked ? "fill" : "regular"}
                className={likeBurst ? "scale-110 transition-transform duration-150" : "transition-transform duration-150"}
              />
              {likeCount > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
                  {likeCount}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleComments}
            className="pill-button cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            ref={commentButtonRef}
          >
            <span className="inline-flex items-center gap-2">
              <ChatCircle size={22} weight="regular" />
              {commentCount > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
                  {commentCount}
                </span>
              )}
            </span>
          </button>
        </div>

        {showComments && (
          <div className="mt-5 border-t border-slate-100 pt-4" ref={commentFormRef}>
            <form onSubmit={handleCommentSubmit} className="flex flex-col gap-3">
              <textarea
                className="soft-input comment-input min-h-[70px] text-sm"
                placeholder="Write a comment..."
                value={commentText}
                ref={commentInputRef}
                onChange={(event) => setCommentText(event.target.value)}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-white cursor-pointer"
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
                comments.map((comment, index) => {
                  const commentOwnerId = comment.userId?._id
                    ? String(comment.userId._id)
                    : null;
                  const isCommentOwner = Boolean(
                    session?.user?.id && commentOwnerId === String(session.user.id)
                  );

                  return (
                    <div
                      key={comment._id}
                      className={`flex gap-3 pt-3 ${
                        index === 0 ? "" : "border-t border-[color:var(--panel-border)]"
                      }`}
                    >
                    <div className="h-9 w-9 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-500">
                      {(comment.userId?.name?.[0] ?? "U").toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-semibold text-[color:var(--ink)]">
                            {comment.userId?.name ?? "User"}
                          </p>
                          <p className="text-xs text-[color:var(--subtle)]">
                            {formatPostTime(comment.createdAt)}
                          </p>
                        </div>
                        {isCommentOwner && (
                          <div className="relative" data-comment-menu>
                            <button
                              type="button"
                              onClick={() =>
                                setCommentMenuId((prev) =>
                                  prev === comment._id ? null : comment._id
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
                                  onClick={() => {
                                    setEditingCommentId(comment._id);
                                    setEditingCommentText(comment.content);
                                    setEditingCommentOriginal(comment.content);
                                    setCommentMenuId(null);
                                  }}
                                  className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCommentMenuId(null);
                                    setPendingDeleteCommentId(comment._id);
                                    setShowCommentDeleteConfirm(true);
                                  }}
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
                          <textarea
                            className="soft-input comment-input min-h-[60px] text-sm"
                            value={editingCommentText}
                            onChange={(event) => setEditingCommentText(event.target.value)}
                          />
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                commentEditMutation.mutate({
                                  id: comment._id,
                                  content: editingCommentText.trim(),
                                })
                              }
                              className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-white cursor-pointer"
                              disabled={!editingCommentText.trim()}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCommentId(null);
                                setEditingCommentText("");
                                setEditingCommentOriginal("");
                              }}
                              className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-1 text-sm text-[color:var(--ink)]">
                          {comment.content}
                        </p>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      <Modal
        title="Delete Post?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your post and cannot be undone.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer pointer-events-auto hover:text-[color:var(--accent)] active:translate-y-[1px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleDelete();
              setShowDeleteConfirm(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
          >
            Delete
          </button>
        </div>
      </Modal>

      <Modal
        title="Discard changes?"
        isOpen={showEditConfirm}
        onClose={() => setShowEditConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved changes. Save before leaving?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowEditConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer pointer-events-auto hover:text-[color:var(--accent)] active:translate-y-[1px]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={async () => {
              await handleEditSave();
              setShowEditConfirm(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--accent)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              handleEditCancel();
              setShowEditConfirm(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
          >
            Discard
          </button>
        </div>
      </Modal>

      <Modal
        title="Discard comment?"
        isOpen={showCommentConfirm}
        onClose={() => setShowCommentConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have an unsent comment. Discard it?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowCommentConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={() => {
              setCommentText("");
              setShowComments(false);
              setShowCommentConfirm(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Discard
          </button>
        </div>
      </Modal>

      <Modal
        title="Delete comment?"
        isOpen={showCommentDeleteConfirm}
        onClose={() => setShowCommentDeleteConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your comment.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowCommentDeleteConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (pendingDeleteCommentId) {
                await commentDeleteMutation.mutateAsync(pendingDeleteCommentId);
              }
              setShowCommentDeleteConfirm(false);
              setPendingDeleteCommentId(null);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Delete
          </button>
        </div>
      </Modal>

      <Modal
        title="Discard changes?"
        isOpen={showCommentEditConfirm}
        onClose={() => setShowCommentEditConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved comment changes. Discard them?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowCommentEditConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setEditingCommentId(null);
              setEditingCommentText("");
              setEditingCommentOriginal("");
              setShowCommentEditConfirm(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Discard
          </button>
        </div>
      </Modal>
    </article>
  );
}
