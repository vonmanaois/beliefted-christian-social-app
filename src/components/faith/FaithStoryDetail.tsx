"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircle, DotsThreeOutline, Heart, UserCircle } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import PostBackHeader from "@/components/ui/PostBackHeader";

type FaithStoryDetailProps = {
  story: {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
    likedBy: string[];
    isAnonymous?: boolean;
    user: { name?: string | null; username?: string | null; image?: string | null } | null;
    userId?: string | null;
  };
};

type Comment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: {
    _id?: string | null;
    name?: string | null;
    image?: string | null;
    username?: string | null;
  } | null;
};

const formatFullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export default function FaithStoryDetail({ story }: FaithStoryDetailProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(story.title);
  const [editContent, setEditContent] = useState(story.content);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentOriginal, setEditingCommentOriginal] = useState("");
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commentEditRef = useRef<HTMLDivElement | null>(null);

  const isOwner =
    Boolean(session?.user?.id && story.userId && String(story.userId) === String(session.user.id));

  const likedBy = Array.isArray(story.likedBy) ? story.likedBy : [];
  const hasLiked = session?.user?.id
    ? likedBy.includes(String(session.user.id))
    : false;

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["faith-story-comments", story._id],
    queryFn: async () => {
      const response = await fetch(`/api/faith-stories/${story._id}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as Comment[];
    },
  });

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
    if (!editingCommentId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (!commentEditRef.current) return;
      if (commentEditRef.current.contains(event.target as Node)) return;
      if (editingCommentText.trim() !== editingCommentOriginal.trim()) return;
      setEditingCommentId(null);
      setEditingCommentText("");
      setEditingCommentOriginal("");
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editingCommentId, editingCommentText, editingCommentOriginal]);

  const likeMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/faith-stories/${story._id}/like`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to like story");
      }
      return (await response.json()) as { count: number; liked: boolean };
    },
    onSuccess: (data) => {
      const viewerId = session?.user?.id ? String(session.user.id) : null;
      if (!viewerId) return;
      queryClient.setQueryData<FaithStoryDetailProps["story"]>(
        ["faith-story", story._id],
        (current) => {
          if (!current) return current;
          const currentLikedBy = Array.isArray(current.likedBy) ? current.likedBy : [];
          const nextLikedBy = data.liked
            ? [...new Set([...currentLikedBy, viewerId])]
            : currentLikedBy.filter((id) => id !== viewerId);
          return { ...current, likedBy: nextLikedBy };
        }
      );
    },
  });

  const commentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/faith-story-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId: story._id, content: commentText.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Failed to post comment");
      }
      return (await response.json()) as Comment;
    },
    onSuccess: async (newComment) => {
      setCommentText("");
      const shouldHydrateUser =
        session?.user?.id &&
        (!newComment.userId ||
          typeof newComment.userId === "string" ||
          !("name" in newComment.userId) ||
          !newComment.userId?.name);
      const hydratedComment = shouldHydrateUser
        ? {
            ...newComment,
            userId: {
              _id: session.user.id,
              name: session.user.name ?? "User",
              image: session.user.image ?? null,
              username: session.user.username ?? null,
            },
          }
        : newComment;
      queryClient.setQueryData<Comment[]>(
        ["faith-story-comments", story._id],
        (current = []) => [hydratedComment as Comment, ...current]
      );
    },
  });

  const commentEditMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await fetch(`/api/faith-story-comments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) {
        throw new Error("Failed to update comment");
      }
      return (await response.json()) as { content: string };
    },
    onSuccess: (data) => {
      if (editingCommentId) {
        queryClient.setQueryData<Comment[]>(
          ["faith-story-comments", story._id],
          (current = []) =>
            current.map((comment) =>
              comment._id === editingCommentId
                ? { ...comment, content: data.content }
                : comment
            )
        );
      }
      setEditingCommentId(null);
      setEditingCommentText("");
      setEditingCommentOriginal("");
    },
  });

  const commentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/faith-story-comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }
    },
    onSuccess: async () => {
      if (pendingDeleteCommentId) {
        queryClient.setQueryData<Comment[]>(
          ["faith-story-comments", story._id],
          (current = []) => current.filter((comment) => comment._id !== pendingDeleteCommentId)
        );
      }
      setPendingDeleteCommentId(null);
      setShowCommentDeleteConfirm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/faith-stories/${story._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle.trim(), content: editContent.trim() }),
      });
      if (!response.ok) {
        throw new Error("Failed to update story");
      }
      return (await response.json()) as { title: string; content: string };
    },
    onSuccess: () => {
      setIsEditing(false);
      router.refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/faith-stories/${story._id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete story");
      }
    },
    onSuccess: () => {
      router.push("/faith-stories");
    },
  });
  const isDeleting = deleteMutation.isPending;

  return (
    <div>
      <PostBackHeader label="Faith Story" />
      <div className="panel p-6 sm:p-8 rounded-none">
        <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
          <span>{formatFullDate(story.createdAt)}</span>
          {isOwner && (
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setShowMenu((prev) => !prev)}
                className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                aria-label="Story actions"
              >
                <DotsThreeOutline size={20} weight="regular" />
              </button>
              {showMenu && (
                <div className="absolute right-0 top-9 z-10 min-w-[160px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setIsEditing(true);
                    }}
                    className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
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

        {!isEditing ? (
          <div className="mt-6 flex flex-col gap-6">
            <div className="text-center">
              <h1 className="text-3xl font-semibold text-[color:var(--ink)]">
                {story.title}
              </h1>
              <div className="mt-3 flex items-center justify-center gap-2 text-xs text-[color:var(--subtle)]">
                {story.isAnonymous ? (
                  <div className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] flex items-center justify-center">
                    <UserCircle size={20} weight="regular" />
                  </div>
                ) : (
                  <Avatar
                    src={story.user?.image ?? null}
                    alt={story.user?.name ?? "User"}
                    size={28}
                    href={
                      story.user?.username ? `/profile/${story.user.username}` : "/profile"
                    }
                    fallback={(story.user?.name?.[0] ?? "U").toUpperCase()}
                    className="h-7 w-7 text-[10px]"
                  />
                )}
                <span>
                  by{" "}
                  <span className="text-[color:var(--ink)] font-semibold">
                    {story.isAnonymous ? "Anonymous" : story.user?.name ?? "User"}
                  </span>{" "}
                  {!story.isAnonymous && story.user?.username
                    ? `@${story.user.username}`
                    : ""}
                </span>
              </div>
            </div>

            <div className="text-sm text-[color:var(--ink)] whitespace-pre-wrap">
              {story.content}
            </div>

            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => likeMutation.mutate()}
                className="inline-flex items-center gap-2 text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                <Heart size={20} weight={hasLiked ? "fill" : "regular"} />
                {likedBy.length > 0 && (
                  <span className="text-xs font-semibold text-[color:var(--ink)]">
                    {likedBy.length}
                  </span>
                )}
              </button>
              <div className="inline-flex items-center gap-2 text-[color:var(--subtle)]">
                <ChatCircle size={20} weight="regular" />
                {comments.length}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-4">
            <input
              className="bg-transparent text-2xl font-semibold text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-3 focus:outline-none focus:ring-0 focus:border-[color:var(--panel-border)] text-center"
              value={editTitle}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <textarea
              className="bg-transparent text-sm text-[color:var(--ink)] outline-none min-h-[260px] resize-none focus:outline-none focus:ring-0"
              value={editContent}
              onChange={(event) => setEditContent(event.target.value)}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => updateMutation.mutate()}
                className="post-button"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 panel p-6 sm:p-8 rounded-none">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
          Comments
        </h2>
        {session?.user?.id ? (
          <form
            className="mt-4 flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!commentText.trim()) return;
              commentMutation.mutate();
            }}
          >
            <textarea
              className="soft-input comment-input min-h-[80px] text-sm"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
            />
            <div className="flex justify-end">
              <button type="submit" className="post-button">
                Post comment
              </button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[color:var(--subtle)]">
            Sign in to comment.
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 text-[13px] sm:text-sm">
          {isLoadingComments ? (
            <div className="text-[color:var(--subtle)]">Loading comments...</div>
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
                    className="h-8 w-8 text-[11px] cursor-pointer"
                  />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] sm:text-xs font-semibold text-[color:var(--ink)]">
                          {comment.userId?.name ?? "User"}
                        </span>
                        {comment.userId?.username && (
                          <span className="text-[11px] sm:text-xs text-[color:var(--subtle)]">
                            @{comment.userId.username}
                          </span>
                        )}
                        <span className="text-[11px] sm:text-xs text-[color:var(--subtle)]">
                          {new Date(comment.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </span>
                      </div>
                      {isCommentOwner && (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCommentId(comment._id);
                              setEditingCommentText(comment.content);
                              setEditingCommentOriginal(comment.content);
                            }}
                            className="text-xs font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPendingDeleteCommentId(comment._id);
                              setShowCommentDeleteConfirm(true);
                            }}
                            className="ml-3 text-xs font-semibold text-[color:var(--danger)]"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                    {editingCommentId === comment._id ? (
                      <div ref={commentEditRef} className="mt-2 flex flex-col gap-2">
                        <textarea
                          className="soft-input comment-input min-h-[56px] text-sm"
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
                            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] cursor-pointer"
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
                      <p className="mt-1 text-[13px] sm:text-sm text-[color:var(--ink)]">
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

      <Modal
        title="Delete story?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your story.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (isDeleting) return;
              await deleteMutation.mutateAsync();
            }}
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete"}
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
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
}
