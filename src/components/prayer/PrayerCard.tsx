"use client";

import { useSession } from "next-auth/react";
import { memo, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import { useUIStore } from "@/lib/uiStore";
import {
  BookOpenText,
  ChatCircle,
  DotsThreeOutline,
  HandsClapping,
  PlusCircle,
  NotePencil,
  UserCircle,
} from "@phosphor-icons/react";

export type PrayerUser = {
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

export type Prayer = {
  _id: string | { $oid?: string };
  content: string;
  heading?: string;
  kind?: "prayer" | "request";
  prayerPoints?: { title: string; description: string }[];
  createdAt: string;
  isAnonymous: boolean;
  prayedBy: string[];
  commentCount?: number;
  user?: PrayerUser | null;
  userId?: string;
  isOwner?: boolean;
};

type PrayerCardProps = {
  prayer: Prayer;
  defaultShowComments?: boolean;
};

type CommentUser = {
  _id?: string | null;
  name?: string | null;
  image?: string | null;
  username?: string | null;
};

type Comment = {
  _id: string;
  content: string;
  createdAt: string;
  userId?: CommentUser | null;
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

const PrayerCard = ({ prayer, defaultShowComments = false }: PrayerCardProps) => {
  const { data: session } = useSession();
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
  const [isPending, setIsPending] = useState(false);
  const [showComments, setShowComments] = useState(defaultShowComments);
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
  const [showEditConfirm, setShowEditConfirm] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [prayError, setPrayError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [editText, setEditText] = useState(prayer.content);
  const [editPoints, setEditPoints] = useState(
    prayer.prayerPoints ?? []
  );
  const [editPointsOriginal, setEditPointsOriginal] = useState(
    JSON.stringify(prayer.prayerPoints ?? [])
  );
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editRef = useRef<HTMLDivElement | null>(null);
  const { openSignIn } = useUIStore();
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
      return (await response.json()) as Comment[];
    },
    enabled: showComments,
  });
  const displayedCommentCount = showComments
    ? comments.length
    : prayer.commentCount ?? 0;

  useEffect(() => {
    if (!isEditing) {
      setEditText(prayer.content);
    }
  }, [prayer.content, isEditing]);

  useEffect(() => {
    if (!isEditing && prayer.kind === "request") {
      setEditPoints(prayer.prayerPoints ?? []);
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
      return (await response.json()) as Comment;
    },
    onSuccess: async (newComment) => {
      setCommentError(null);
      setCommentText("");
      updatePrayerCache((item) => ({
        ...item,
        commentCount: (item.commentCount ?? 0) + 1,
      }));
      queryClient.setQueryData<Comment[]>(
        ["prayer-comments", prayerId],
        (current = []) => [newComment, ...current]
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
        queryClient.setQueryData<Comment[]>(
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
      queryClient.setQueryData<Comment[]>(
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
        setEditPoints(data.prayerPoints);
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
    mutationFn: async () => {
      const response = await fetch(`/api/prayers/${prayerId}`, {
        method: "DELETE",
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
      await queryClient.invalidateQueries({ queryKey: ["prayers"] });
    },
  });

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
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "prayed", entityId: prayerId }),
        });
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("stats:refresh"));
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    },
  });

  const handlePray = async () => {
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
  };

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

  const handleCardClick = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (target.closest("button, a, input, textarea, select, [data-ignore-view]")) return;
    if (prayer.isAnonymous) {
      router.push(`/anonymous/${prayerId}`);
      return;
    }
    if (!prayer.user?.username) return;
    router.push(`/${prayer.user.username}/${prayerId}`);
  };

  const handleCommentSubmit = async (event?: React.FormEvent) => {
    if (event) {
      event.preventDefault();
    }
    event.preventDefault();

    if (!session?.user?.id) {
      openSignIn();
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

  const handleDelete = async () => {
    if (!isOwner) return;
    try {
      await deleteMutation.mutateAsync();
    } catch (error) {
      console.error(error);
    }
  };

  const handleEditStart = () => {
    setEditError(null);
    if (prayer.kind === "request") {
      setEditPoints(requestPoints);
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
      setEditPoints(requestPoints);
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

  return (
    <article className="wall-card flex gap-2 sm:gap-3 rounded-none cursor-pointer" onClick={handleCardClick}>
      <div className="avatar-ring">
        {prayer.isAnonymous ? (
          <div className="avatar-core">
            <UserCircle size={28} weight="regular" />
          </div>
        ) : (
          <Avatar
            src={prayer.user?.image ?? null}
            alt={prayer.user?.name ?? "User"}
            size={32}
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
                  <a
                    href={
                      prayer.user?.username
                        ? `/profile/${prayer.user.username}`
                        : "/profile"
                    }
                    className="text-xs sm:text-sm font-semibold text-[color:var(--ink)] hover:underline"
                  >
                    {prayer.user?.name ?? "User"}
                  </a>
                  {prayer.user?.username && (
                    <span className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
                      @{prayer.user.username}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-[10px] sm:text-xs text-[color:var(--subtle)]">
              {formatPostTime(prayer.createdAt)}
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
                      Edit Prayer
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full rounded-xl px-4 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Delete Prayer
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {isEditing ? (
          <div ref={editRef} className="mt-3 flex flex-col gap-2">
            {prayer.kind === "request" ? (
              <div className="flex flex-col gap-3">
                {editPoints.map((point, index) => (
                  <div key={`${point.title}-${index}`} className="flex flex-col gap-2">
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
                    <textarea
                      className="soft-input min-h-[80px] text-sm"
                      placeholder="Prayer description..."
                      value={point.description}
                      onChange={(event) => {
                        const next = [...editPoints];
                        next[index] = { ...next[index], description: event.target.value };
                        setEditPoints(next);
                      }}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setEditPoints((prev) => [...prev, { title: "", description: "" }])
                  }
                  className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
                >
                  <PlusCircle size={16} weight="regular" />
                  Add prayer point
                </button>
              </div>
            ) : (
              <textarea
                className="soft-input min-h-[100px] text-sm"
                value={editText}
                onChange={(event) => setEditText(event.target.value)}
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
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-1 text-sm font-semibold text-[color:var(--accent)]">
              <NotePencil size={16} weight="regular" />
              Prayer Request
            </div>
            <div className="mt-3 space-y-3">
              {requestPoints.map((point, index) => (
                <div key={`${point.title}-${index}`}>
                  <p className="text-[13px] sm:text-sm font-semibold text-[color:var(--ink)]">
                    {point.title}
                  </p>
                  <p className="mt-2 text-[13px] sm:text-sm leading-relaxed text-[color:var(--subtle)]">
                    {point.description}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface-strong)] px-3 py-1 text-sm font-semibold text-[color:var(--subtle)]">
              <BookOpenText size={16} weight="regular" className="text-[color:var(--accent)]" />
              Prayer
            </div>
            <p className="mt-3 text-[13px] sm:text-sm leading-relaxed text-[color:var(--ink)]">
              {prayer.content}
            </p>
          </>
        )}
        <div className="mt-2 sm:mt-3 flex items-center gap-1.5 sm:gap-3 text-[11px] sm:text-xs">
          {isOwner ? (
            <span className="text-xs font-semibold text-[color:var(--subtle)]">
              Your prayer
            </span>
          ) : (
            <button
              type="button"
              onClick={handlePray}
              disabled={!session?.user?.id || isPending || hasPrayed}
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
            onClick={toggleComments}
            className="inline-flex items-center justify-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
            ref={commentButtonRef}
          >
            <span className="inline-flex items-center gap-2">
              <ChatCircle size={22} weight="regular" />
              {displayedCommentCount > 0 && (
                <span className="text-xs font-semibold text-[color:var(--ink)]">
                  {displayedCommentCount}
                </span>
              )}
            </span>
          </button>
          {prayedBy.length > 0 && (
            <div className="ml-auto text-[10px] sm:text-xs text-[color:var(--subtle)]">
              <span className="font-semibold text-[color:var(--ink)]">
                {prayedBy.length}
              </span>{" "}
              people prayed
            </div>
          )}
        </div>
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

        {showComments && (
          <div ref={commentFormRef} className="mt-3 border-t border-slate-100 pt-3">
            {session?.user?.id && (
              <form onSubmit={handleCommentSubmit} className="flex flex-col gap-2">
                <textarea
                  className="soft-input comment-input min-h-[56px] sm:min-h-[64px] text-sm"
                  placeholder="Write a comment..."
                  value={commentText}
                  ref={commentInputRef}
                  onChange={(event) => setCommentText(event.target.value)}
                />
                <div className="flex justify-end">
                  <button type="submit" className="post-button">
                    Post comment
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
        title="Delete Prayer?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
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
