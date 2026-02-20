"use client";

import { useSession } from "next-auth/react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import dynamic from "next/dynamic";
import Avatar from "@/components/ui/Avatar";
import DeferredEmbed from "@/components/ui/DeferredEmbed";
import MentionText from "@/components/ui/MentionText";
import MentionTextarea from "@/components/ui/MentionTextarea";
import { useUIStore } from "@/lib/uiStore";
import { useAdmin } from "@/hooks/useAdmin";
import type { Prayer, PrayerComment } from "@/components/prayer/types";

const Modal = dynamic(() => import("@/components/layout/Modal"), { ssr: false });
const PrayerComments = dynamic(() => import("@/components/prayer/PrayerComments"), {
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
const ADMIN_REASONS = ["Off-topic", "Inappropriate", "Spam", "Asking money"] as const;
import {
  BookOpenText,
  ChatCircle,
  DotsThreeOutline,
  Globe,
  HandsClapping,
  LockSimple,
  PlusCircle,
  NotePencil,
  MinusCircle,
  UserCircle,
  UsersThree,
} from "@phosphor-icons/react";

export type { Prayer } from "@/components/prayer/types";

type PrayerCardProps = {
  prayer: Prayer;
  defaultShowComments?: boolean;
};


type EditPoint = {
  id: string;
  title: string;
  description: string;
};

const makePointId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const mapEditPoints = (points?: { title: string; description: string }[]) =>
  (points ?? []).map((point) => ({
    id: makePointId(),
    title: point.title ?? "",
    description: point.description ?? "",
  }));

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

const PrayerCard = ({ prayer, defaultShowComments = false }: PrayerCardProps) => {
  const { data: session } = useSession();
  const { data: adminData } = useAdmin();
  const isAdmin = Boolean(adminData?.isAdmin);
  const router = useRouter();
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
  const createdAtValue =
    prayer.createdAt instanceof Date ? prayer.createdAt : new Date(prayer.createdAt);
  const [isPending, setIsPending] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
  const [commentsActive, setCommentsActive] = useState(defaultShowComments);
  const [commentsReady, setCommentsReady] = useState(defaultShowComments);
  const [showCommentConfirm, setShowCommentConfirm] = useState(false);
  const [commentText, setCommentText] = useState("");
  const commentFormRef = useRef<HTMLDivElement | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement | null>(null);
  const commentButtonRef = useRef<HTMLButtonElement | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentOriginal, setEditingCommentOriginal] = useState("");
  const [showCommentEditConfirm, setShowCommentEditConfirm] = useState(false);
  const [commentMenuId, setCommentMenuId] = useState<string | null>(null);
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const commentEditRef = useRef<HTMLDivElement | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState(false);
  const [adminReason, setAdminReason] = useState<string>("");
  const [isRemoving, setIsRemoving] = useState(false);
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [prayError, setPrayError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [showFullContent, setShowFullContent] = useState(false);
  const [editText, setEditText] = useState(prayer.content);
  const [editPoints, setEditPoints] = useState<EditPoint[]>(() =>
    mapEditPoints(prayer.prayerPoints)
  );
  const [editPointsOriginal, setEditPointsOriginal] = useState(
    JSON.stringify(prayer.prayerPoints ?? [])
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const openSignIn = useUIStore((state) => state.openSignIn);
  const stopPropagation = useCallback((event: React.MouseEvent) => {
    event.stopPropagation();
  }, []);
  const isOwner =
    prayer.isOwner ??
    Boolean(
      session?.user?.id &&
        prayer.userId &&
        String(prayer.userId) === String(session.user.id)
    );
  const prayedBy = Array.isArray(prayer.prayedBy) ? prayer.prayedBy : [];
  const hasPrayed = session?.user?.id
    ? prayedBy.includes(String(session.user.id))
    : false;
  const requestPoints = prayer.prayerPoints ?? [];
  const updatePrayerCache = (updater: (item: Prayer) => Prayer) => {
    queryClient.setQueriesData<{ pages: { items: Prayer[] }[]; pageParams: unknown[] }>(
      { queryKey: ["prayers"] },
      (data) => {
        if (!data) return data;
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              normalizeId(item._id) === prayerId ? updater(item) : item
            ),
          })),
        };
      }
    );
  };


  const { data: comments = [], isLoading: isLoadingComments } = useQuery({
    queryKey: ["prayer-comments", prayerId],
    queryFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}/comments`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load comments");
      }
      return (await response.json()) as PrayerComment[];
    },
    enabled: commentsActive,
  });
  const displayedCommentCount = commentsActive
    ? comments.length
    : prayer.commentCount ?? 0;

  useEffect(() => {
    if (!isEditing) {
      setEditText(prayer.content);
    }
  }, [prayer.content, isEditing]);

  useEffect(() => {
    if (!isEditing && prayer.kind === "request") {
      setEditPoints(mapEditPoints(prayer.prayerPoints));
      setEditPointsOriginal(JSON.stringify(prayer.prayerPoints ?? []));
    }
  }, [prayer.kind, prayer.prayerPoints, isEditing]);

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
      if (prayer.kind === "request") {
        const cleaned = editPoints
          .map((point) => ({
            title: point.title.trim(),
            description: point.description.trim(),
          }))
          .filter((point) => point.title && point.description);
        if (JSON.stringify(cleaned) !== editPointsOriginal) {
          setShowEditConfirm(true);
        } else {
          setIsEditing(false);
        }
        return;
      }
      if (editText.trim() !== prayer.content.trim()) {
        setShowEditConfirm(true);
      } else {
        setIsEditing(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, editText, prayer.content, editPoints, editPointsOriginal, prayer.kind]);

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
        if (response.status === 401) {
          openSignIn();
        }
        throw new Error("Failed to post comment");
      }
      return (await response.json()) as PrayerComment;
    },
    onSuccess: async (newComment) => {
      setCommentError(null);
      setCommentText("");
      updatePrayerCache((item) => ({
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
      queryClient.setQueryData<PrayerComment[]>(
        ["prayer-comments", prayerId],
        (current = []) => [hydratedComment as PrayerComment, ...current]
      );
    },
    onError: () => {
      setCommentError("Couldn't post comment.");
    },
  });

  const commentEditMutation = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      const response = await fetch(`/api/comments/${id}`, {
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
        queryClient.setQueryData<PrayerComment[]>(
          ["prayer-comments", prayerId],
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
      await queryClient.invalidateQueries({
        queryKey: ["prayer-comments", prayerId],
      });
    },
    onError: () => {
      setCommentError("Couldn't update comment.");
    },
  });

  const commentDeleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/comments/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete comment");
      }
      return id;
    },
    onSuccess: async (deletedId) => {
      setCommentError(null);
      queryClient.setQueryData<PrayerComment[]>(
        ["prayer-comments", prayerId],
        (current = []) => current.filter((comment) => comment._id !== deletedId)
      );
      updatePrayerCache((item) => ({
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
      setEditError(null);
      if (prayer.kind === "request") {
        const cleanedPoints = editPoints
          .map((point) => ({
            title: point.title.trim(),
            description: point.description.trim(),
          }))
          .filter((point) => point.title && point.description);

        if (cleanedPoints.length === 0) {
          setEditError("Add at least one prayer point with a title and description.");
          throw new Error("Validation failed");
        }

        const response = await fetch(`/api/prayers/${prayerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prayerPoints: cleanedPoints }),
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
        return (await response.json()) as {
          prayerPoints: { title: string; description: string }[];
        };
      }

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
      if (prayer.kind === "request" && "prayerPoints" in data) {
        setEditPoints(mapEditPoints(data.prayerPoints));
        setEditPointsOriginal(JSON.stringify(data.prayerPoints));
        updatePrayerCache((item) => ({
          ...item,
          prayerPoints: data.prayerPoints,
        }));
      } else if ("content" in data) {
        updatePrayerCache((item) => ({
          ...item,
          content: data.content,
        }));
      }
      setIsEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: "DELETE",
        headers: reason ? { "Content-Type": "application/json" } : undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
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
          openSignIn();
        }
        throw new Error(message);
      }
    },
    onSuccess: async () => {
      setShowMenu(false);
      setIsRemoving(true);
      await new Promise((resolve) => setTimeout(resolve, 260));
      await queryClient.invalidateQueries({ queryKey: ["prayers"] });
      if (defaultShowComments) {
        router.back();
      }
    },
  });
  const isDeleting = deleteMutation.isPending;

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
          openSignIn();
        }
        throw new Error(message);
      }
      return (await response.json()) as { count: number };
    },
    onMutate: async () => {
      setPrayError(null);
      if (!session?.user?.id || hasPrayed) return null;
      const previous = queryClient.getQueriesData({ queryKey: ["prayers"] });
      const viewerId = String(session.user.id);
      updatePrayerCache((item) => {
        const current = Array.isArray(item.prayedBy) ? item.prayedBy : [];
        if (current.includes(viewerId)) return item;
        return { ...item, prayedBy: [...current, viewerId] };
      });
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        context.previous.forEach(([key, data]) => {
          queryClient.setQueryData(key, data);
        });
      }
      setPrayError("Couldn't record prayer.");
    },
    onSuccess: () => {
      setPrayError(null);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("stats:refresh"));
      }
    },
  });

  const handlePray = useCallback(async () => {
    if (!session?.user?.id) {
      openSignIn();
      return;
    }

    setPrayError(null);
    setIsPending(true);

    try {
      await prayMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    } finally {
      setIsPending(false);
    }
  }, [session?.user?.id, openSignIn, prayMutation]);

  const scheduleCommentsActivation = useCallback(() => {
    if (commentsActive && commentsReady) return;
    const activate = () => {
      setCommentsActive(true);
      setCommentsReady(true);
    };
    if (typeof window === "undefined") {
      activate();
      return;
    }
    if ("requestIdleCallback" in window) {
      (window as Window & { requestIdleCallback?: (cb: () => void) => number })
        .requestIdleCallback?.(activate);
      return;
    }
    setTimeout(activate, 0);
  }, [commentsActive, commentsReady]);

  const toggleComments = useCallback(() => {
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
    if (!showComments) {
      setCommentsReady(false);
      return;
    }
    scheduleCommentsActivation();
  }, [showComments, scheduleCommentsActivation]);

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button, a, input, textarea, select, [data-ignore-view]")) return;
    router.push(`/post/${prayerId}`, { scroll: false });
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

  const handleStartEditComment = useCallback((comment: PrayerComment) => {
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

  const handleEditStart = () => {
    setEditError(null);
    if (prayer.kind === "request") {
      setEditPoints(mapEditPoints(requestPoints));
      setEditPointsOriginal(JSON.stringify(requestPoints));
    } else {
      setEditText(prayer.content);
    }
    setIsEditing(true);
    setShowMenu(false);
  };

  const handleEditCancel = () => {
    setIsEditing(false);
    setEditError(null);
    if (prayer.kind === "request") {
      setEditPoints(mapEditPoints(requestPoints));
      setEditPointsOriginal(JSON.stringify(requestPoints));
    } else {
      setEditText(prayer.content);
    }
  };

  const handleEditSave = async () => {
    if (prayer.kind !== "request" && !editText.trim()) return;
    try {
      await editMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    }
  };

  const { videoId, cleaned } = extractYouTube(prayer.content);
  const displayContent =
    showFullContent || cleaned.length <= 320
      ? cleaned
      : `${cleaned.slice(0, 320).trimEnd()}…`;

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
      className={`wall-card flex flex-col gap-3 rounded-none cursor-pointer transition-card ${
        isRemoving ? "fade-out-card" : ""
      }`}
      onClick={handleCardClick}
      style={{ contentVisibility: "auto", containIntrinsicSize: "1px 900px" }}
    >
      <PrayerHeader
        prayer={prayer}
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
            {prayer.kind === "request" ? (
              <div className="flex flex-col gap-3">
                {editPoints.map((point, index) => (
                  <div key={point.id} className="flex flex-col gap-2">
                    <input
                      className="soft-input text-sm"
                      placeholder="Prayer point (title)"
                      value={point.title}
                      onChange={(event) => {
                        const next = [...editPoints];
                        next[index] = { ...next[index], title: event.target.value };
                        setEditPoints(next);
                      }}
                    />
                    <MentionTextarea
                      value={point.description}
                      onChangeValue={(nextValue) => {
                        const next = [...editPoints];
                        next[index] = { ...next[index], description: nextValue };
                        setEditPoints(next);
                      }}
                      placeholder="Prayer description..."
                      className="soft-input min-h-[80px] text-sm w-full"
                    />
                    {editPoints.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditPoints((prev) => prev.filter((item) => item.id !== point.id));
                        }}
                        className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--danger)] hover:text-[color:var(--danger-strong)]"
                      >
                        <MinusCircle size={16} weight="regular" />
                        Remove point
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditPoints((prev) => [
                      ...prev,
                      { id: makePointId(), title: "", description: "" },
                    ])
                  }
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  <PlusCircle size={16} weight="regular" />
                  Add prayer point
                </button>
              </div>
            ) : (
              <MentionTextarea
                value={editText}
                onChangeValue={setEditText}
                className="soft-input min-h-[100px] text-sm w-full"
              />
            )}
            {editError && (
              <p className="text-xs text-[color:var(--danger)]">{editError}</p>
            )}
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
        ) : prayer.kind === "request" && requestPoints.length ? (
          <>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-1 text-sm font-semibold text-[color:var(--accent)]">
              <NotePencil size={16} weight="regular" />
              Prayer Request
            </div>
            {prayer.scriptureRef && (
              <div className="mt-2">
                <span className="verse-chip">
                  <BookOpenText size={14} weight="regular" />
                  {prayer.scriptureRef}
                </span>
              </div>
            )}
            <div className="mt-3 space-y-3">
              {requestPoints.map((point, index) => (
                <div key={`${point.title}-${index}`}>
                  <p className="text-[13px] sm:text-sm font-semibold text-[color:var(--ink)]">
                    <MentionText text={point.title} />
                  </p>
                  <p className="mt-2 text-[13px] sm:text-sm leading-relaxed text-[color:var(--subtle)] whitespace-pre-line">
                    <MentionText text={point.description} />
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface-strong)] px-3 py-1 text-sm font-semibold text-[color:var(--subtle)]">
              <BookOpenText size={16} weight="regular" className="text-[color:var(--accent)]" />
              Prayer
            </div>
            {prayer.scriptureRef && (
              <p className="mt-2 text-xs font-semibold text-[color:var(--accent)]">
                {prayer.scriptureRef}
              </p>
            )}
            <>
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
              {videoId && (
                <PrayerEmbeds
                  videoId={videoId}
                  onStopPropagation={stopPropagation}
                />
              )}
            </>
          </>
        )}
        <PrayerActions
          isOwner={isOwner}
          hasPrayed={hasPrayed}
          isPending={isPending}
          onPray={handlePray}
          onToggleComments={toggleComments}
          commentCount={displayedCommentCount}
          prayedCount={prayedBy.length}
          privacy={prayer.privacy ?? "public"}
          commentButtonRef={commentButtonRef}
        />
        {prayError && !isOwner && (
          <div className="mt-2 text-[11px] text-[color:var(--subtle)] flex items-center gap-2">
            <span>{prayError}</span>
            <button
              type="button"
              onClick={handlePray}
              className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] text-xs font-semibold"
            >
              Retry
            </button>
          </div>
        )}

        {showComments &&
          (commentsReady ? (
            <PrayerComments
              sessionUserId={session?.user?.id ? String(session.user.id) : null}
              commentText={commentText}
              onCommentTextChange={setCommentText}
              commentInputRef={commentInputRef}
              commentFormRef={commentFormRef}
              onSubmit={handleCommentSubmit}
              onRetrySubmit={handleCommentSubmit}
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
              formatPostTime={formatPostTime}
            />
          ) : (
            <div className="mt-3 text-[11px] text-[color:var(--subtle)]">
              Loading encouragements...
            </div>
          ))}
      </div>

      <Modal
        title="Delete Prayer?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        autoFocus={false}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your prayer and cannot be undone.
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
          Choose a reason for removing this prayer. The author will be notified.
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

    </article>
  );
};

export default memo(PrayerCard);

type PrayerEmbedsProps = {
  videoId: string;
  onStopPropagation: (event: React.MouseEvent) => void;
};

const PrayerEmbeds = memo(function PrayerEmbeds({
  videoId,
  onStopPropagation,
}: PrayerEmbedsProps) {
  return (
    <div
      className="mt-4 aspect-video w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-black/5"
      onClick={onStopPropagation}
    >
      <DeferredEmbed
        title="YouTube embed"
        className="h-full w-full"
        src={buildYouTubeSrc(videoId)}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        placeholder={
          <div className="flex h-full w-full items-center justify-center bg-[color:var(--panel)] text-xs font-semibold text-[color:var(--subtle)]">
            Tap to load video
          </div>
        }
      />
    </div>
  );
});

type PrayerHeaderProps = {
  prayer: Prayer;
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

const PrayerHeader = memo(function PrayerHeader({
  prayer,
  createdAtIso,
  isOwner,
  isAdmin,
  showMenu,
  menuRef,
  onToggleMenu,
  onEdit,
  onDelete,
  onAdminDelete,
}: PrayerHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className="avatar-ring">
        {prayer.isAnonymous ? (
          <div className="avatar-core">
            <UserCircle size={28} weight="regular" />
          </div>
        ) : (
          <Avatar
            src={prayer.user?.image ?? null}
            alt={prayer.user?.name ?? "User"}
            size={64}
            sizes="(min-width: 640px) 48px, 32px"
            href={
              prayer.user?.username
                ? `/profile/${prayer.user.username}`
                : "/profile"
            }
            fallback={(prayer.user?.name?.[0] ?? "U").toUpperCase()}
            className="avatar-core cursor-pointer h-8 w-8 sm:h-12 sm:w-12"
          />
        )}
      </div>
      <div className="flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              {prayer.isAnonymous ? (
                <p className="text-xs sm:text-sm font-semibold text-[color:var(--ink)]">
                  Anonymous
                </p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <Link
                    href={
                      prayer.user?.username
                        ? `/profile/${prayer.user.username}`
                        : "/profile"
                    }
                    prefetch={false}
                    className="text-xs sm:text-sm font-semibold text-[color:var(--ink)] hover:underline"
                  >
                    {prayer.user?.name ?? "User"}
                  </Link>
                  {prayer.user?.username && (
                    <span className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
                      @{prayer.user.username}
                    </span>
                  )}
                </div>
              )}
            </div>
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
                        Edit Prayer
                      </button>
                    )}
                    {isOwner && (
                      <button
                        type="button"
                        onClick={onDelete}
                        className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                      >
                        Delete Prayer
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

type PrayerActionsProps = {
  isOwner: boolean;
  hasPrayed: boolean;
  isPending: boolean;
  onPray: () => void;
  onToggleComments: () => void;
  commentCount: number;
  prayedCount: number;
  privacy: Prayer["privacy"];
  commentButtonRef: React.RefObject<HTMLButtonElement | null>;
};

const PrayerActions = memo(function PrayerActions({
  isOwner,
  hasPrayed,
  isPending,
  onPray,
  onToggleComments,
  commentCount,
  prayedCount,
  privacy,
  commentButtonRef,
}: PrayerActionsProps) {
  return (
    <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs">
      {isOwner ? (
        <span className="text-xs font-semibold text-[color:var(--subtle)]">
          Your prayer
        </span>
      ) : (
        <button
          type="button"
          onClick={onPray}
          disabled={isPending || hasPrayed}
          className={`pill-button inline-flex items-center justify-center gap-2 rounded-lg transition-colors ${
            hasPrayed
              ? "cursor-not-allowed text-[color:var(--accent-strong)] opacity-60"
              : "cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          }`}
          aria-label={hasPrayed ? "Prayed" : "Pray"}
        >
          <HandsClapping
            size={22}
            weight={hasPrayed ? "fill" : "regular"}
            className={hasPrayed ? "text-[color:var(--accent-strong)]" : undefined}
          />
          <span className="text-xs font-semibold">
            {hasPrayed ? "Prayed" : "Pray"}
          </span>
        </button>
      )}
      <button
        type="button"
        onClick={onToggleComments}
        aria-label="Encourage prayer"
        className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
        ref={commentButtonRef}
      >
        <span className="inline-flex items-center gap-2">
          <ChatCircle size={22} weight="regular" />
          <span className="text-xs font-semibold text-[color:var(--subtle)]">
            Encourage
          </span>
          {commentCount > 0 && (
            <span className="text-xs font-semibold text-[color:var(--ink)]">
              {commentCount}
            </span>
          )}
        </span>
      </button>
      <div className="ml-auto flex items-center gap-2 text-[10px] sm:text-xs text-[color:var(--subtle)]">
        {prayedCount > 0 && (
          <span>
            <span className="font-semibold text-[color:var(--ink)]">
              {prayedCount}
            </span>{" "}
            people prayed
          </span>
        )}
        <span className="text-[color:var(--subtle)]">
          {privacy === "private" ? (
            <LockSimple size={16} weight="regular" />
          ) : privacy === "followers" ? (
            <UsersThree size={16} weight="regular" />
          ) : (
            <Globe size={16} weight="regular" />
          )}
        </span>
      </div>
    </div>
  );
});
