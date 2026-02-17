"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import {
  BookOpenText,
  BookmarkSimple,
  ChatCircle,
  DotsThreeOutline,
  Globe,
  Heart,
  LockSimple,
  UsersThree,
} from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import { useUIStore } from "@/lib/uiStore";
import MentionText from "@/components/ui/MentionText";
import MentionTextarea from "@/components/ui/MentionTextarea";
import { useAdmin } from "@/hooks/useAdmin";
import { cloudinaryTransform } from "@/lib/cloudinary";
import DeferredEmbed from "@/components/ui/DeferredEmbed";
import type { Word, WordCommentData, CommentUser } from "@/components/word/types";

const Modal = dynamic(() => import("@/components/layout/Modal"), { ssr: false });
const WordComments = dynamic(() => import("@/components/word/WordComments"), {
  ssr: false,
  loading: () => (
    <div className="mt-3 border-t border-slate-100 pt-3 pb-6">
      <div className="h-10 w-full animate-pulse rounded-xl bg-[color:var(--panel)]" />
    </div>
  ),
});

const extractYouTube = (value: string) => {
  let videoId: string | null = null;
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
      } else if (parsed.pathname.startsWith("/live/")) {
        candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      } else if (parsed.pathname.startsWith("/embed/")) {
        candidate = parsed.pathname.split("/").filter(Boolean)[1] ?? null;
      }
    }

    if (candidate) {
      if (!videoId) videoId = candidate;
      cleaned = cleaned.replace(rawUrl, "").trim();
    }
  }

  return { videoId, cleaned };
};

const ADMIN_REASONS = ["Off-topic", "Inappropriate", "Spam", "Asking money"] as const;

const extractSpotify = (value: string) => {
  let embedUrl: string | null = null;
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
    if (host !== "open.spotify.com") continue;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const type = parts[0];
      const id = parts[1];
      if (!embedUrl) {
        embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
      }
      cleaned = cleaned.replace(rawUrl, "").trim();
    }
  }

  return { embedUrl, cleaned };
};

const buildYouTubeSrc = (videoId: string) => {
  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

export type { Word } from "@/components/word/types";

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
  const { data: adminData } = useAdmin();
  const isAdmin = Boolean(adminData?.isAdmin);
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
  const likedBy = useMemo(
    () => (Array.isArray(word.likedBy) ? word.likedBy : []),
    [word.likedBy]
  );
  const savedBy = Array.isArray(word.savedBy) ? word.savedBy : [];
  const [localLikedBy, setLocalLikedBy] = useState<string[]>(likedBy);
  const savedCount = savedBy.length;
  const viewerId = session?.user?.id ? String(session.user.id) : null;
  const hasLiked = viewerId ? localLikedBy.includes(viewerId) : false;

  useEffect(() => {
    setLocalLikedBy(likedBy);
  }, [likedBy]);

  useEffect(() => {
    const node = imageStripRef.current;
    if (!node) return;
    const imgs = Array.from(
      node.querySelectorAll<HTMLImageElement>("img[data-orientation-key]")
    );
    if (imgs.length === 0) return;
    setImageOrientations((prev) => {
      let next = prev;
      let didUpdate = false;
      imgs.forEach((img) => {
        const key = img.dataset.orientationKey;
        if (!key || prev[key]) return;
        if (!img.complete || !img.naturalWidth || !img.naturalHeight) return;
        const nextOrientation =
          img.naturalHeight > img.naturalWidth ? "portrait" : "landscape";
        if (!didUpdate) {
          next = { ...prev };
          didUpdate = true;
        }
        next[key] = nextOrientation;
      });
      return didUpdate ? next : prev;
    });
  }, [word.images]);

  const hasSaved = session?.user?.id
    ? savedBy.includes(String(session.user.id))
    : false;
  const [likeBurst, setLikeBurst] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [commentsActive, setCommentsActive] = useState(defaultShowComments);
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
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState(false);
  const [adminReason, setAdminReason] = useState<string>("");
  const [showCommentConfirm, setShowCommentConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(word.content ?? "");
  const [isRemoving, setIsRemoving] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [imageOrientations, setImageOrientations] = useState<
    Record<string, "portrait" | "landscape">
  >({});
  const stopPropagation = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);
  const isDraggingImagesRef = useRef(false);
  const dragMovedRef = useRef(false);
  const lastDragDeltaRef = useRef(0);
  const dragRafRef = useRef<number | null>(null);
  const dragPendingDeltaRef = useRef(0);
  const dragStartXRef = useRef(0);
  const dragStartScrollRef = useRef(0);
  const [likeError, setLikeError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const imageStripRef = useRef<HTMLDivElement | null>(null);
  const imageSectionRef = useRef<HTMLDivElement | null>(null);
  const [imagesActive, setImagesActive] = useState(false);
  useEffect(() => {
    if (!Array.isArray(word.images) || word.images.length === 0) return;
    const node = imageSectionRef.current;
    if (!node) return;
    if (imagesActive) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          if ("requestIdleCallback" in window) {
            (window as Window & { requestIdleCallback?: (cb: () => void) => number })
              .requestIdleCallback?.(() => setImagesActive(true));
          } else {
            setImagesActive(true);
          }
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [imagesActive, word.images]);
  const openSignIn = useUIStore((state) => state.openSignIn);
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

  const updateWordCacheNonSaved = (updater: (item: Word) => Word) => {
    queryClient.setQueriesData<{ pages: { items: Word[] }[]; pageParams: unknown[] }>(
      {
        queryKey: ["words"],
        predicate: (query) =>
          Array.isArray(query.queryKey) && !query.queryKey.includes("saved"),
      },
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
  const updateFollowingCache = (updater: (item: Word) => Word) => {
    queryClient.setQueriesData<{ pages: { items: Array<{ type: string; word?: Word }> }[]; pageParams: unknown[] }>(
      { queryKey: ["following-feed"] },
      (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => {
              if (item?.type !== "word" || !item.word) return item;
              return normalizeId(item.word._id) === wordId
                ? { ...item, word: updater(item.word) }
                : item;
            }),
          })),
        };
      }
    );
  };
  const removeFromSavedCache = () => {
    queryClient.setQueriesData<{ pages: { items: Word[] }[]; pageParams: unknown[] }>(
      {
        queryKey: ["words"],
        predicate: (query) =>
          Array.isArray(query.queryKey) && query.queryKey.includes("saved"),
      },
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
    enabled: commentsActive,
  });
  const displayedCommentCount = commentsActive
    ? comments.length
    : word.commentCount ?? 0;

  useEffect(() => {
    if (!isEditing) {
      setEditText(word.content ?? "");
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
      if (!viewerId) return null;
      const previous = queryClient.getQueriesData({ queryKey: ["words"] });
      const previousLocal = localLikedBy;
      const already = previousLocal.includes(viewerId);
      const nextLocal = already
        ? previousLocal.filter((id) => id !== viewerId)
        : [...previousLocal, viewerId];
      setLocalLikedBy(nextLocal);
      updateWordCache((item) => {
        const current = Array.isArray(item.likedBy) ? item.likedBy : [];
        const nextLikedBy = already
          ? current.filter((id) => id !== viewerId)
          : [...current, viewerId];
        return { ...item, likedBy: nextLikedBy };
      });
      if (!hasLiked) {
        setLikeBurst(true);
        setTimeout(() => setLikeBurst(false), 180);
      }
      return { previous, previousLocal };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousLocal) {
        setLocalLikedBy(context.previousLocal);
      }
      setLikeError("Couldn't update like.");
    },
    onSuccess: () => {
      setLikeError(null);
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
    onMutate: async () => {
      const viewerId = session?.user?.id ? String(session.user.id) : null;
      if (!viewerId) return { previousWords: null, previousFollowing: null, viewerId: null };
      const previousWords = queryClient.getQueriesData({
        queryKey: ["words"],
      });
      const previousFollowing = queryClient.getQueriesData({
        queryKey: ["following-feed"],
      });
      const applyOptimistic = (item: Word) => {
        const currentSaved = Array.isArray(item.savedBy) ? item.savedBy : [];
        const nextSavedBy = currentSaved.includes(viewerId)
          ? currentSaved.filter((id) => id !== viewerId)
          : [...currentSaved, viewerId];
        return { ...item, savedBy: nextSavedBy };
      };
      updateWordCache(applyOptimistic);
      updateFollowingCache(applyOptimistic);
      return { previousWords, previousFollowing, viewerId };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousWords) {
        context.previousWords.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      if (context?.previousFollowing) {
        context.previousFollowing.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
    },
    onSuccess: (data) => {
      const viewerId = session?.user?.id ? String(session.user.id) : null;
      if (!viewerId) return;
      if (savedOnly && !data.saved) {
        setIsRemoving(true);
        setTimeout(() => {
          removeFromSavedCache();
        }, 260);
        updateWordCacheNonSaved((item) => {
          const currentSaved = Array.isArray(item.savedBy) ? item.savedBy : [];
          const nextSavedBy = currentSaved.filter((id) => id !== viewerId);
          return { ...item, savedBy: nextSavedBy };
        });
        queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "words" &&
            query.queryKey.includes("saved"),
        });
        return;
      }
      updateWordCache((item) => {
        const currentSaved = Array.isArray(item.savedBy) ? item.savedBy : [];
        const nextSavedBy = data.saved
          ? [...new Set([...currentSaved, viewerId])]
          : currentSaved.filter((id) => id !== viewerId);
        return { ...item, savedBy: nextSavedBy };
      });
      updateFollowingCache((item) => {
        const currentSaved = Array.isArray(item.savedBy) ? item.savedBy : [];
        const nextSavedBy = data.saved
          ? [...new Set([...currentSaved, viewerId])]
          : currentSaved.filter((id) => id !== viewerId);
        return { ...item, savedBy: nextSavedBy };
      });
      queryClient.invalidateQueries({
        predicate: (query) =>
          Array.isArray(query.queryKey) &&
          query.queryKey[0] === "words" &&
          query.queryKey.includes("saved"),
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
              username:
                (session.user as { username?: string | null })?.username ?? null,
            },
          }
        : newComment;
      queryClient.setQueryData<WordCommentData[]>(
        ["word-comments", wordId],
        (current = []) => [hydratedComment as WordCommentData, ...current]
      );
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
    mutationFn: async (reason?: string) => {
      const response = await fetch(`/api/words/${wordId}`, {
        method: "DELETE",
        headers: reason ? { "Content-Type": "application/json" } : undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
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

  const scheduleCommentsActivation = useCallback(() => {
    if (commentsActive) return;
    if (typeof window === "undefined") {
      setCommentsActive(true);
      return;
    }
    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback?.(() => setCommentsActive(true));
      return;
    }
    setTimeout(() => setCommentsActive(true), 0);
  }, [commentsActive]);

  const toggleComments = useCallback((event?: React.MouseEvent) => {
    event?.stopPropagation();
    setShowComments((prev) => {
      if (prev) {
        if (commentText.trim().length > 0) {
          setShowCommentConfirm(true);
          return prev;
        }
        setCommentText("");
        return false;
      }
      scheduleCommentsActivation();
      setTimeout(() => commentInputRef.current?.focus(), 0);
      return true;
    });
  }, [commentText, scheduleCommentsActivation]);

  useEffect(() => {
    if (showComments) {
      scheduleCommentsActivation();
    }
  }, [showComments, scheduleCommentsActivation]);

  const handleLike = useCallback(async (event?: React.MouseEvent) => {
    event?.stopPropagation();
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
  }, [session?.user?.id, openSignIn, likeMutation]);

  const handleSave = useCallback(async (event?: React.MouseEvent) => {
    event?.stopPropagation();
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
  }, [session?.user?.id, openSignIn, saveMutation]);

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

  const handleStartEditComment = useCallback((comment: WordCommentData) => {
    setEditingCommentId(comment._id);
    setEditingCommentText(comment.content);
    setEditingCommentOriginal(comment.content);
    setCommentMenuId(null);
  }, []);

  const handleCancelEditComment = useCallback(() => {
    setEditingCommentId(null);
    setEditingCommentText("");
    setEditingCommentOriginal("");
  }, []);

  const handleSaveEditComment = useCallback(
    (id: string, content: string) => {
      commentEditMutation.mutate({ id, content: content.trim() });
    },
    [commentEditMutation]
  );

  const handleRequestDeleteComment = useCallback((id: string) => {
    setCommentMenuId(null);
    setPendingDeleteCommentId(id);
    setShowCommentDeleteConfirm(true);
  }, []);

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
    setEditText(word.content ?? "");
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditText(word.content ?? "");
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
      await deleteMutation.mutateAsync(undefined);
    } catch (error) {
      console.error(error);
    }
  };

  const handleAdminDelete = async () => {
    if (!isAdmin || !adminReason) return;
    try {
      await deleteMutation.mutateAsync(adminReason);
    } catch (error) {
      console.error(error);
    }
  };

  const { videoId: youtubeId, cleaned: youtubeCleaned } = extractYouTube(word.content ?? "");
  const { embedUrl: spotifyEmbed, cleaned: cleaned } = extractSpotify(youtubeCleaned);
  const displayContent =
    showFullContent || cleaned.length <= 320
      ? cleaned
      : `${cleaned.slice(0, 320).trimEnd()}…`;
  const sharedStory = word.sharedFaithStory ?? null;
  const sharedStoryMissing = !sharedStory && Boolean(word.sharedFaithStoryId);
  const sharedStoryHref =
    sharedStory?.authorUsername && sharedStory?.id
      ? `/faith-story/${sharedStory.authorUsername}/${sharedStory.id}`
      : null;

  const toggleMenu = useCallback(() => {
    setShowMenu((prev) => !prev);
  }, []);
  const openDeleteConfirm = useCallback(() => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  }, []);
  const openAdminDeleteConfirm = useCallback(() => {
    setShowMenu(false);
    setAdminReason("");
    setShowAdminDeleteConfirm(true);
  }, []);

  return (
    <article
      className={`wall-card flex flex-col gap-3 rounded-none cursor-pointer transition-card overflow-hidden max-w-full min-w-0 ${isRemoving ? "fade-out-card" : ""}`}
      onClick={handleCardClick}
      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 900px" }}
    >
      <WordHeader
        user={word.user}
        createdAtIso={createdAtValue.toISOString()}
        isOwner={isOwner}
        isAdmin={isAdmin}
        showMenu={showMenu}
        menuRef={menuRef}
        onToggleMenu={toggleMenu}
        onEdit={handleEditStart}
        onDelete={openDeleteConfirm}
        onAdminDelete={openAdminDeleteConfirm}
      />
      <div>
        {isEditing ? (
          <div ref={editRef} className="mt-3 flex flex-col gap-2">
            <MentionTextarea
              value={editText}
              onChangeValue={setEditText}
              className="soft-input min-h-[100px] text-sm w-full"
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
                <MentionText text={displayContent} />
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
            {(sharedStory || sharedStoryMissing) && (
              <div
                className="mt-3 w-full max-w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  if (sharedStoryHref) {
                    router.push(sharedStoryHref);
                  }
                }}
              >
                {sharedStory?.coverImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={cloudinaryTransform(sharedStory.coverImage, { width: 720 })}
                    alt=""
                    className="h-40 w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="p-3">
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {sharedStory ? sharedStory.title : "Story unavailable"}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--accent)]">
                    {sharedStory ? "Read full story" : "This story is no longer available."}
                  </p>
                </div>
              </div>
            )}
            {(youtubeId || spotifyEmbed) && (
              <WordEmbeds
                youtubeId={youtubeId}
                spotifyEmbed={spotifyEmbed}
                onStopPropagation={stopPropagation}
              />
            )}
            {Array.isArray(word.images) && word.images.length > 0 && (
              <div
                ref={imageSectionRef}
                className="mt-3 relative w-full max-w-full overflow-hidden"
              >
                {!imagesActive ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setImagesActive(true);
                    }}
                    className="flex w-full items-center justify-center rounded-md border border-dashed border-[color:var(--border)] bg-white/70 px-4 py-6 text-sm font-medium text-[color:var(--ink)]"
                  >
                    Tap to load photos ({word.images.length})
                  </button>
                ) : (
                  <>
                    {word.images.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const node = imageStripRef.current;
                            if (!node) return;
                            node.scrollBy({ left: -node.clientWidth, behavior: "smooth" });
                          }}
                          className="hidden sm:flex absolute left-0 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[color:var(--ink)] shadow-md"
                          aria-label="Scroll images left"
                        >
                          ‹
                        </button>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            const node = imageStripRef.current;
                            if (!node) return;
                            node.scrollBy({ left: node.clientWidth, behavior: "smooth" });
                          }}
                          className="hidden sm:flex absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9 items-center justify-center rounded-full bg-white/80 text-[color:var(--ink)] shadow-md"
                          aria-label="Scroll images right"
                        >
                          ›
                        </button>
                      </>
                    )}
                    <div
                      ref={imageStripRef}
                      className="flex min-w-0 w-full max-w-full gap-3 overflow-x-auto pb-1 snap-x snap-mandatory overscroll-x-contain sm:cursor-grab sm:active:cursor-grabbing"
                      style={{ touchAction: "pan-x" }}
                      onPointerDown={(event) => {
                        if (event.pointerType !== "mouse") return;
                        const node = imageStripRef.current;
                        if (!node) return;
                        node.setPointerCapture?.(event.pointerId);
                        isDraggingImagesRef.current = true;
                        dragMovedRef.current = false;
                        lastDragDeltaRef.current = 0;
                        dragPendingDeltaRef.current = 0;
                        dragStartXRef.current = event.clientX;
                        dragStartScrollRef.current = node.scrollLeft;
                      }}
                      onPointerMove={(event) => {
                        if (!isDraggingImagesRef.current) return;
                        const node = imageStripRef.current;
                        if (!node) return;
                        const delta = event.clientX - dragStartXRef.current;
                        lastDragDeltaRef.current = delta;
                        if (Math.abs(delta) > 4) {
                          dragMovedRef.current = true;
                        }
                        dragPendingDeltaRef.current = delta;
                        if (dragRafRef.current == null) {
                          dragRafRef.current = window.requestAnimationFrame(() => {
                            if (imageStripRef.current) {
                              imageStripRef.current.scrollLeft =
                                dragStartScrollRef.current - dragPendingDeltaRef.current;
                            }
                            dragRafRef.current = null;
                          });
                        }
                      }}
                      onPointerUp={() => {
                        if (!isDraggingImagesRef.current) return;
                        isDraggingImagesRef.current = false;
                        if (dragRafRef.current != null) {
                          window.cancelAnimationFrame(dragRafRef.current);
                          dragRafRef.current = null;
                        }
                        const shouldBlock = Math.abs(lastDragDeltaRef.current) > 6;
                        dragMovedRef.current = shouldBlock;
                        window.setTimeout(() => {
                          dragMovedRef.current = false;
                          lastDragDeltaRef.current = 0;
                        }, 0);
                      }}
                      onPointerCancel={() => {
                        isDraggingImagesRef.current = false;
                        dragMovedRef.current = false;
                        lastDragDeltaRef.current = 0;
                        if (dragRafRef.current != null) {
                          window.cancelAnimationFrame(dragRafRef.current);
                          dragRafRef.current = null;
                        }
                      }}
                      onPointerLeave={() => {
                        isDraggingImagesRef.current = false;
                        dragMovedRef.current = false;
                        lastDragDeltaRef.current = 0;
                        if (dragRafRef.current != null) {
                          window.cancelAnimationFrame(dragRafRef.current);
                          dragRafRef.current = null;
                        }
                      }}
                    >
                      {word.images.map((src, index) => {
                      const isCloudinary =
                        typeof src === "string" && src.includes("res.cloudinary.com");
                      const thumbSrc = isCloudinary
                        ? cloudinaryTransform(src, { width: 600 })
                        : src;
                      const key = `${src}-${index}`;
                      const storedOrientation = word.imageOrientations?.[index];
                      const orientation =
                        storedOrientation ?? imageOrientations[key] ?? "landscape";
                      const aspectClass =
                        orientation === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]";
                      return (
                        <div
                          key={key}
                          className={`relative shrink-0 snap-start w-[60%] sm:w-[44%] max-w-[220px] ${aspectClass} overflow-hidden rounded-md border border-transparent`}
                          onClick={(event) => {
                            event.stopPropagation();
                            if (dragMovedRef.current || Math.abs(lastDragDeltaRef.current) > 6) {
                              return;
                            }
                            const fullSrc = isCloudinary
                              ? cloudinaryTransform(src, { width: 1200 })
                              : src;
                            setLightboxSrc(fullSrc);
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={thumbSrc}
                            alt=""
                            data-orientation-key={key}
                            className="h-full w-full object-cover"
                            loading="lazy"
                            onLoad={(event) => {
                              const { naturalWidth, naturalHeight } = event.currentTarget;
                              if (!naturalWidth || !naturalHeight) return;
                              const next =
                                naturalHeight > naturalWidth ? "portrait" : "landscape";
                              setImageOrientations((prev) =>
                                prev[key] === next ? prev : { ...prev, [key]: next }
                              );
                            }}
                          />
                        </div>
                      );
                    })}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        <WordActions
          hasLiked={hasLiked}
          likeCount={localLikedBy.length}
          likeBurst={likeBurst}
          isLiking={isLiking}
          onLike={handleLike}
          onToggleComments={toggleComments}
          commentCount={displayedCommentCount}
          hasSaved={hasSaved}
          savedCount={savedCount}
          isSaving={isSaving}
          onSave={handleSave}
          privacy={word.privacy ?? "public"}
          commentButtonRef={commentButtonRef}
        />
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
          <WordComments
            sessionUserId={session?.user?.id ? String(session.user.id) : null}
            commentText={commentText}
            onCommentTextChange={setCommentText}
            commentInputRef={commentInputRef}
            commentFormRef={commentFormRef}
            onSubmit={handleCommentSubmit}
            commentError={commentError}
            isLoading={isLoadingComments}
            comments={comments}
            commentMenuId={commentMenuId}
            onToggleCommentMenu={setCommentMenuId}
            editingCommentId={editingCommentId}
            editingCommentText={editingCommentText}
            onEditingCommentTextChange={setEditingCommentText}
            onStartEdit={handleStartEditComment}
            onCancelEdit={handleCancelEditComment}
            onSaveEdit={handleSaveEditComment}
            onRequestDelete={handleRequestDeleteComment}
            commentEditRef={commentEditRef}
            onRetrySubmit={handleCommentSubmit}
            formatPostTime={formatPostTime}
          />
        )}
      </div>

      <Modal
        title="Delete Post?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        autoFocus={false}
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
        title="Admin Delete"
        isOpen={showAdminDeleteConfirm}
        onClose={() => setShowAdminDeleteConfirm(false)}
        autoFocus={false}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          Choose a reason for removing this post. The author will be notified.
        </p>
        <div className="mt-4 grid gap-2">
          {ADMIN_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => setAdminReason(reason)}
              className={`w-full rounded-lg px-3 py-2 text-left text-sm font-semibold border ${
                adminReason === reason
                  ? "border-transparent bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                  : "border-[color:var(--panel-border)] text-[color:var(--ink)] hover:border-[color:var(--accent)]"
              }`}
            >
              {reason}
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowAdminDeleteConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer pointer-events-auto hover:text-[color:var(--accent)] active:translate-y-[1px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              if (isDeleting || !adminReason) return;
              await handleAdminDelete();
              setShowAdminDeleteConfirm(false);
            }}
            disabled={isDeleting || !adminReason}
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

      <Modal
        title=""
        isOpen={Boolean(lightboxSrc)}
        onClose={() => setLightboxSrc(null)}
      >
        {lightboxSrc && (
          <div className="w-full rounded-lg bg-[linear-gradient(180deg,#ffffff_0%,#f7f7f4_100%)] px-4 pt-4 pb-14 shadow-[0_16px_32px_-22px_rgba(0,0,0,0.55)] border border-black/10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxSrc}
              alt="Word image"
              className="block w-full max-h-[68vh] object-contain rounded-none bg-white"
            />
          </div>
        )}
      </Modal>
    </article>
  );
};

export default memo(WordCard);

type WordEmbedsProps = {
  youtubeId: string | null;
  spotifyEmbed: string | null;
  onStopPropagation: (event: React.MouseEvent) => void;
};

const WordEmbeds = memo(function WordEmbeds({
  youtubeId,
  spotifyEmbed,
  onStopPropagation,
}: WordEmbedsProps) {
  return (
    <>
      {youtubeId && (
        <div
          className="mt-3 aspect-video w-full max-w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)]"
          onClick={onStopPropagation}
        >
          <DeferredEmbed
            title="YouTube embed"
            className="h-full w-full"
            src={buildYouTubeSrc(youtubeId)}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            placeholder={
              <div className="flex h-full w-full items-center justify-center bg-[color:var(--panel)] text-xs font-semibold text-[color:var(--subtle)]">
                Tap to load video
              </div>
            }
          />
        </div>
      )}
      {spotifyEmbed && (
        <div
          className="mt-3 w-full max-w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)]"
          onClick={onStopPropagation}
        >
          <DeferredEmbed
            title="Spotify embed"
            className="h-[152px] w-full"
            src={spotifyEmbed}
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            height={152}
            placeholder={
              <div className="flex h-full w-full items-center justify-center bg-[color:var(--panel)] text-xs font-semibold text-[color:var(--subtle)]">
                Tap to load audio
              </div>
            }
          />
        </div>
      )}
    </>
  );
});

type WordHeaderProps = {
  user: Word["user"] | undefined;
  createdAtIso: string;
  isOwner: boolean;
  isAdmin: boolean;
  showMenu: boolean;
  menuRef: React.RefObject<HTMLDivElement | null>;
  onToggleMenu: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAdminDelete: () => void;
};

const WordHeader = memo(function WordHeader({
  user,
  createdAtIso,
  isOwner,
  isAdmin,
  showMenu,
  menuRef,
  onToggleMenu,
  onEdit,
  onDelete,
  onAdminDelete,
}: WordHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="avatar-ring">
        <Avatar
          src={user?.image ?? null}
          alt={user?.name ?? "User"}
          size={64}
          sizes="(min-width: 640px) 48px, 32px"
          href={user?.username ? `/profile/${user.username}` : "/profile"}
          fallback={(user?.name?.[0] ?? "W").toUpperCase()}
          className="avatar-core cursor-pointer h-8 w-8 sm:h-12 sm:w-12"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <a
              href={user?.username ? `/profile/${user.username}` : "/profile"}
              className="text-xs sm:text-sm font-semibold text-[color:var(--ink)] hover:underline"
            >
              {user?.name ?? "User"}
            </a>
            <p className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
              {user?.username ? `@${user.username}` : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 pr-1">
            <p className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
              {formatPostTime(createdAtIso)}
            </p>
            {(isOwner || isAdmin) && (
              <div className="relative" ref={menuRef}>
                <button
                  type="button"
                  onClick={onToggleMenu}
                  className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                  aria-label="More actions"
                >
                  <DotsThreeOutline size={20} weight="regular" />
                </button>
                {showMenu && (
                  <div className="absolute right-0 top-10 z-10 min-w-[200px] rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
                    {isOwner && (
                      <button
                        type="button"
                        onClick={onEdit}
                        className="mb-1 w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                      >
                        Edit Post
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={onDelete}
                        className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                      >
                        Delete Post
                      </button>
                    )}
                    {isAdmin && !isOwner && (
                      <button
                        type="button"
                        onClick={onAdminDelete}
                        className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                      >
                        Admin Delete
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

type WordActionsProps = {
  hasLiked: boolean;
  likeCount: number;
  likeBurst: boolean;
  isLiking: boolean;
  onLike: (event?: React.MouseEvent) => void;
  onToggleComments: (event?: React.MouseEvent) => void;
  commentCount: number;
  hasSaved: boolean;
  savedCount: number;
  isSaving: boolean;
  onSave: (event?: React.MouseEvent) => void;
  privacy: Word["privacy"];
  commentButtonRef: React.RefObject<HTMLButtonElement | null>;
};

const WordActions = memo(function WordActions({
  hasLiked,
  likeCount,
  likeBurst,
  isLiking,
  onLike,
  onToggleComments,
  commentCount,
  hasSaved,
  savedCount,
  isSaving,
  onSave,
  privacy,
  commentButtonRef,
}: WordActionsProps) {
  return (
    <div className="mt-2 sm:mt-3 flex items-center gap-2 sm:gap-3 text-[11px] sm:text-xs">
      <button
        type="button"
        onClick={onLike}
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
          {likeCount > 0 && (
            <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
              {likeCount}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onToggleComments}
        aria-label="Reflect on word"
        className="pill-button cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
        ref={commentButtonRef}
      >
        <span className="inline-flex items-center gap-2">
          <ChatCircle size={22} weight="regular" />
          <span className="text-xs font-semibold text-[color:var(--subtle)]">
            Reflect
          </span>
          {commentCount > 0 && (
            <span className="text-xs font-semibold text-[color:var(--ink)] transition-all duration-200">
              {commentCount}
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onSave}
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
      <span className="ml-auto text-[color:var(--subtle)]">
        {privacy === "private" ? (
          <LockSimple size={16} weight="regular" />
        ) : privacy === "followers" ? (
          <UsersThree size={16} weight="regular" />
        ) : (
          <Globe size={16} weight="regular" />
        )}
      </span>
    </div>
  );
});
