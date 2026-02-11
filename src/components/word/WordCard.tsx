"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenText, BookmarkSimple, ChatCircle, DotsThreeOutline, Heart, SpotifyLogo } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import YouTubeEmbed from "@/components/ui/YouTubeEmbed";
import { useUIStore } from "@/lib/uiStore";

const extractMedia = (value: string) => {
  let videoId: string | null = null;
  let spotifyEmbed: string | null = null;
  let spotifyUrl: string | null = null;
  let cleaned = value;
  const urlMatches = value.match(/https?:\/\/\S+/gi) ?? [];

  for (const rawUrl of urlMatches) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(rawUrl);
    } catch {
      parsed = null;
    }
    if (!parsed) continue;

    const host = parsed.hostname.replace(/^www\./, "");
    let candidate: string | null = null;

    if (host === "youtu.be") {
      candidate = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    } else if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (parsed.pathname.startsWith("/watch")) {
        candidate = parsed.searchParams.get("v");
      } else if (parsed.pathname.startsWith("/shorts/")) {
        candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      } else if (parsed.pathname.startsWith("/embed/")) {
        candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }

    if (candidate) {
      candidate = encodeURIComponent(candidate);
      if (!videoId) videoId = candidate;
      cleaned = cleaned.replace(rawUrl, "").trim();
      continue;
    }

    if (host === "open.spotify.com") {
      const parts = parsed.pathname.split("/").filter(Boolean);
      const type = parts[0];
      const id = parts[1];
      if (type && id) {
        const safeType = encodeURIComponent(type);
        const safeId = encodeURIComponent(id);
        if (!spotifyEmbed) {
          spotifyEmbed = `https://open.spotify.com/embed/${safeType}/${safeId}`;
          spotifyUrl = `https://open.spotify.com/${safeType}/${safeId}`;
        }
        cleaned = cleaned.replace(rawUrl, "").trim();
      }
    }
  }

  return { videoId, spotifyEmbed, spotifyUrl, cleaned };
};

export type WordUser = {
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type Word = {
  _id: string | { $oid?: string };
  content: string;
  createdAt: string | Date;
  likedBy?: string[];
  savedBy?: string[];
  commentCount?: number;
  user?: WordUser | null;
  userId?: string | null;
  isOwner?: boolean;
  scriptureRef?: string | null;
};

type WordCommentData = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
};

type CommentUser = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

type WordCardProps = {
  word: Word;
  defaultShowComments?: boolean;
  savedOnly?: boolean;
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

const WordCard = ({ word, defaultShowComments = false, savedOnly = false }: WordCardProps) => {
  const { data: session } = useSession();
  const router = useRouter();
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
  const createdAtValue =
    word.createdAt instanceof Date ? word.createdAt : new Date(word.createdAt);
  const likedBy = Array.isArray(word.likedBy) ? word.likedBy : [];
  const savedBy = Array.isArray(word.savedBy) ? word.savedBy : [];
  const savedCount = savedBy.length;
  const hasLiked = session?.user?.id
    ? likedBy.includes(String(session.user.id))
    : false;
  const hasSaved = session?.user?.id
    ? savedBy.includes(String(session.user.id))
    : false;
  const [likeBurst, setLikeBurst] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
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
  const [isSaving, setIsSaving] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [showCommentConfirm, setShowCommentConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(word.content);
  const [isRemoving, setIsRemoving] = useState(false);
  const [likeError, setLikeError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const { openSignIn } = useUIStore();
  const isOwner =
    word.isOwner ??
    Boolean(
      session?.user?.id &&
        word.userId &&
        String(word.userId) === String(session.user.id)
    );
  const updateWordCache = (updater: (item: Word) => Word) => {
    queryClient.setQueriesData<{ pages: { items: Word[] }[]; pageParams: unknown[] }>(
      { queryKey: ["words"] },
      (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              normalizeId(item._id) === wordId ? updater(item) : item
            ),
          })),
        };
      }
    );
  };

  const removeFromSavedCache = () => {
    queryClient.setQueriesData<{ pages: { items: Word[] }[]; pageParams: unknown[] }>(
      { queryKey: ["words"] },
      (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.filter((item) => normalizeId(item._id) !== wordId),
          })),
        };
      }
    );
  };

  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["word-comments", wordId],
    queryFn: async () => {
      const response = await fetch(`/api/words/${wordId}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as WordCommentData[];
    },
    enabled: showComments,
  });
  const displayedCommentCount = showComments
    ? comments.length
    : word.commentCount ?? 0;

  useEffect(() => {
    if (!isEditing) {
      setEditText(word.content);
    }
  }, [word.content, isEditing]);

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
      if (editText.trim() !== word.content.trim()) {
        setShowEditConfirm(true);
      } else {
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, editText, word.content]);

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
          openSignIn();
        }
        throw new Error(message);
      }
      return (await response.json()) as { count: number; liked?: boolean };
    },
    onMutate: async () => {
      setLikeError(null);
      if (!session?.user?.id) return null;
      const previous = queryClient.getQueriesData({ queryKey: ["words"] });
      const viewerId = String(session.user.id);
      updateWordCache((item) => {
        const current = Array.isArray(item.likedBy) ? item.likedBy : [];
        const already = current.includes(viewerId);
        const nextLikedBy = already
          ? current.filter((id) => id !== viewerId)
          : [...current, viewerId];
        return { ...item, likedBy: nextLikedBy };
      });
      if (!hasLiked) {
        setLikeBurst(true);
        setTimeout(() => setLikeBurst(false), 180);
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      setLikeError("Couldn't update like.");
    },
    onSuccess: () => {
      setLikeError(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/words/${wordId}/save`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error("Failed to save word");
      }
      return (await response.json()) as { saved: boolean };
    },
    onSuccess: (data) => {
      const viewerId = session?.user?.id ? String(session.user.id) : null;
      if (!viewerId) return;
      if (savedOnly && !data.saved) {
        setIsRemoving(true);
        setTimeout(() => {
          removeFromSavedCache();
        }, 260);
        return;
      }
      updateWordCache((item) => {
        const currentSaved = Array.isArray(item.savedBy) ? item.savedBy : [];
        const nextSavedBy = data.saved
          ? [...new Set([...currentSaved, viewerId])]
          : currentSaved.filter((id) => id !== viewerId);
        return { ...item, savedBy: nextSavedBy };
      });
    },
  });

  const [commentError, setCommentError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);

  const commentMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/word-comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordId, content: commentText.trim() }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          openSignIn();
        }
        throw new Error("Failed to post comment");
      }
      return (await response.json()) as { _id: string; content: string; createdAt: string; userId?: CommentUser | null };
    },
    onSuccess: async (newComment) => {
      setCommentError(null);
      setCommentText("");
      updateWordCache((item) => ({
        ...item,
        commentCount: (item.commentCount ?? 0) + 1,
      }));
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
      queryClient.setQueryData<WordCommentData[]>(
        ["word-comments", wordId],
        (current = []) => [hydratedComment as WordCommentData, ...current]
      );
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    },
    onError: () => {
      setCommentError("Couldn't post comment.");
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
      return (await response.json()) as { content: string };
    },
    onSuccess: async (data) => {
      setCommentError(null);
      if (editingCommentId) {
        queryClient.setQueryData<WordCommentData[]>(
          ["word-comments", wordId],
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
    },
    onError: () => {
      setCommentError("Couldn't update comment.");
    },
  });

  const commentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/word-comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        if (response.status === 401) {
          openSignIn();
        }
        throw new Error("Failed to delete comment");
      }
      return id;
    },
    onSuccess: async (deletedId) => {
      setCommentError(null);
      queryClient.setQueryData<WordCommentData[]>(
        ["word-comments", wordId],
        (current = []) => current.filter((comment) => comment._id !== deletedId)
      );
      updateWordCache((item) => ({
        ...item,
        commentCount: Math.max(0, (item.commentCount ?? 0) - 1),
      }));
    },
    onError: () => {
      setCommentError("Couldn't delete comment.");
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
        if (response.status === 401) {
          openSignIn();
        }
        throw new Error(message);
      }
      return (await response.json()) as { content: string };
    },
    onSuccess: async (data) => {
      updateWordCache((item) => ({
        ...item,
        content: data.content,
      }));
      setIsEditing(false);
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
          openSignIn();
        }
        throw new Error(message);
      }
    },
    onSuccess: async () => {
      setShowMenu(false);
      setIsRemoving(true);
      await new Promise((resolve) => setTimeout(resolve, 260));
      await queryClient.invalidateQueries({ queryKey: ["words"] });
      queryClient.invalidateQueries({
        queryKey: ["words"],
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("saved"),
      });
      if (defaultShowComments) {
        router.back();
      }
    },
  });
  const isDeleting = deleteMutation.isPending;

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
      openSignIn();
      return;
    }

    setLikeError(null);
    setIsLiking(true);
    try {
      await likeMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    } finally {
      setIsLiking(false);
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) {
      openSignIn();
      return;
    }
    setIsSaving(true);
    try {
      await saveMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCommentSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }

    if (!session?.user?.id) {
      openSignIn();
      return;
    }

    if (!commentText.trim()) return;

    commentMutation.mutate();
  };

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button, a, input, textarea, select, [data-ignore-view]")) return;
    if (!word.user?.username) return;
    router.push(`/${word.user.username}/${wordId}`);
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
    setEditText(word.content);
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText(word.content);
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

  const { videoId, spotifyEmbed, spotifyUrl, cleaned } = extractMedia(word.content);
  const displayContent =
    showFullContent || cleaned.length <= 320
      ? cleaned
      : `${cleaned.slice(0, 320).trimEnd()}…`;

  return (
    <article
      className={`wall-card flex flex-col gap-3 rounded-none cursor-pointer transition-card ${isRemoving ? "fade-out-card" : ""}`}
      onClick={handleCardClick}
    >
      <div className="flex items-start gap-3">
        <div className="avatar-ring">
          <Avatar
            src={word.user?.image ?? null}
            alt={word.user?.name ?? "User"}
            size={64}
            sizes="(min-width: 640px) 48px, 32px"
            href={word.user?.username ? `/profile/${word.user.username}` : "/profile"}
            fallback={(word.user?.name?.[0] ?? "W").toUpperCase()}
            className="avatar-core cursor-pointer h-8 w-8 sm:h-12 sm:w-12"
          />
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <a
                href={word.user?.username ? `/profile/${word.user.username}` : "/profile"}
                className="text-xs sm:text-sm font-semibold text-[color:var(--ink)] hover:underline"
              >
                {word.user?.name ?? "User"}
              </a>
              <p className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
                {word.user?.username ? `@${word.user.username}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 pr-1">
              <p className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
                {formatPostTime(createdAtValue.toISOString())}
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
        </div>
      </div>
      <div>
        {isEditing ? (
          <div ref={editRef} className="mt-3 flex flex-col gap-2">
            <textarea
              className="soft-input min-h-[100px] text-sm"
              value={editText}
              onChange={(event) => setEditText(event.target.value)}
            />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleEditSave}
                className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
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
          <>
            {word.scriptureRef && (
              <div className="mt-2">
                <span className="verse-chip">
                  <BookOpenText size={14} weight="regular" />
                  {word.scriptureRef}
                </span>
              </div>
            )}
            {cleaned && (
              <p className="mt-3 text-[13px] sm:text-sm leading-relaxed text-[color:var(--ink)] whitespace-pre-line">
                {displayContent}
              </p>
            )}
            {cleaned.length > 320 && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    setShowFullContent((prev) => !prev);
                  }}
                  className="mt-2 text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  {showFullContent ? "Done" : "Continue"}
                </button>
              )}
            {videoId && (
              <div
                className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-black/5"
                onClick={(event) => event.stopPropagation()}
              >
                <YouTubeEmbed videoId={videoId} className="h-full w-full" />
              </div>
            )}
            {spotifyEmbed && (
              <div
                className="mt-4 w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-black/5"
                onClick={(event) => event.stopPropagation()}
              >
                <iframe
                  src={spotifyEmbed}
                  title="Spotify player"
                  loading="lazy"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  className="h-[152px] w-full"
                />
              </div>
            )}
            {spotifyUrl && (
              <a
                href={spotifyUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
                onClick={(event) => event.stopPropagation()}
              >
                <SpotifyLogo size={16} weight="regular" />
                Play on Spotify
              </a>
            )}
          </>
        )}
        <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
          <button
            type="button"
            onClick={handleLike}
            disabled={isLiking}
            aria-label={hasLiked ? "Unlike word" : "Like word"}
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
              {likedBy.length > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
                  {likedBy.length}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={toggleComments}
            aria-label="Reflect on word"
            className="pill-button cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            ref={commentButtonRef}
          >
            <span className="inline-flex items-center gap-2">
              <ChatCircle size={22} weight="regular" />
              <span className="text-xs font-semibold text-[color:var(--subtle)]">
                Reflect
              </span>
              {displayedCommentCount > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
                  {displayedCommentCount}
                </span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            aria-label={hasSaved ? "Unsave word" : "Save word"}
            className={`pill-button cursor-pointer transition-colors ${
              hasSaved
                ? "text-[color:var(--accent-strong)]"
                : "text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            }`}
          >
            <span className="inline-flex items-center gap-2">
              <BookmarkSimple size={22} weight={hasSaved ? "fill" : "regular"} />
              {savedCount > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
                  {savedCount}
                </span>
              )}
            </span>
          </button>
        </div>
        {likeError && (
          <div className="mt-2 text-[11px] text-[color:var(--subtle)] flex items-center gap-2">
            <span>{likeError}</span>
            <button
              type="button"
              onClick={handleLike}
              className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {showComments && (
          <div className="mt-3 border-t border-slate-100 pt-3" ref={commentFormRef}>
            {session?.user?.id && (
              <form onSubmit={handleCommentSubmit} className="flex flex-col gap-2">
                <textarea
                  className="soft-input comment-input min-h-[56px] sm:min-h-[64px] text-sm"
                  placeholder="Share a reflection..."
                  value={commentText}
                  ref={commentInputRef}
                  onChange={(event) => setCommentText(event.target.value)}
                />
                <div className="flex justify-end">
                  <button type="submit" className="post-button">
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
                  onClick={() => handleCommentSubmit()}
                  className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] text-xs font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="mt-3 flex flex-col gap-3 text-[13px] sm:text-sm">
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
                <div className="text-[color:var(--subtle)] text-[13px] sm:text-sm">
                  No comments yet.
                </div>
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
                      className="h-8 w-8 sm:h-9 sm:w-9 text-[11px] sm:text-xs cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <a
                            href={
                              comment.userId?.username
                                ? `/profile/${comment.userId.username}`
                                : "/profile"
                            }
                            className="text-[11px] sm:text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:underline"
                          >
                            {comment.userId?.name ?? "User"}
                          </a>
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
                            className="soft-input comment-input min-h-[56px] sm:min-h-[60px] text-sm"
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
              if (isDeleting) return;
              await handleDelete();
              setShowDeleteConfirm(false);
            }}
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px] disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete"}
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
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] bg-[color:var(--accent)] cursor-pointer pointer-events-auto hover:opacity-90 active:translate-y-[1px]"
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
};

export default memo(WordCard);
