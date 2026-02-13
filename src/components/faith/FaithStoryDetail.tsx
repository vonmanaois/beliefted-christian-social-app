"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { cloudinaryTransform } from "@/lib/cloudinary";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChatCircle, DotsThreeOutline, Heart, ImageSquare, UserCircle, ShareNetwork, X } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import PostBackHeader from "@/components/ui/PostBackHeader";
import { useAdmin } from "@/hooks/useAdmin";

type FaithStoryDetailProps = {
  story: {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
    likedBy: string[];
    isAnonymous?: boolean;
    coverImage?: string | null;
    sharedCount?: number;
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

const ADMIN_REASONS = ["Off-topic", "Inappropriate", "Spam", "Asking money"] as const;

export default function FaithStoryDetail({ story }: FaithStoryDetailProps) {
  const { data: session } = useSession();
  const { data: adminData } = useAdmin();
  const isAdmin = Boolean(adminData?.isAdmin);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAdminDeleteConfirm, setShowAdminDeleteConfirm] = useState(false);
  const [adminReason, setAdminReason] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(story.title);
  const [editContent, setEditContent] = useState(story.content);
  const [showFullContent, setShowFullContent] = useState(false);
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreview, setEditCoverPreview] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentText, setEditingCommentText] = useState("");
  const [editingCommentOriginal, setEditingCommentOriginal] = useState("");
  const [showCommentDeleteConfirm, setShowCommentDeleteConfirm] = useState(false);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareText, setShareText] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const commentEditRef = useRef<HTMLDivElement | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);

  const isOwner =
    Boolean(session?.user?.id && story.userId && String(story.userId) === String(session.user.id));

  const [localLikedBy, setLocalLikedBy] = useState<string[]>(
    Array.isArray(story.likedBy) ? story.likedBy : []
  );

  useEffect(() => {
    setLocalLikedBy(Array.isArray(story.likedBy) ? story.likedBy : []);
  }, [story._id, story.likedBy]);

  const hasLiked = session?.user?.id
    ? localLikedBy.includes(String(session.user.id))
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
    onMutate: async () => {
      if (!session?.user?.id) return null;
      const viewerId = String(session.user.id);
      const previous = localLikedBy;
      const alreadyLiked = previous.includes(viewerId);
      const nextLikedBy = alreadyLiked
        ? previous.filter((id) => id !== viewerId)
        : [...previous, viewerId];
      setLocalLikedBy(nextLikedBy);
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        setLocalLikedBy(context.previous);
      }
    },
    onSuccess: (data) => {
      const viewerId = session?.user?.id ? String(session.user.id) : null;
      if (!viewerId) return;
      setLocalLikedBy((current) => {
        const nextLikedBy = data.liked
          ? [...new Set([...current, viewerId])]
          : current.filter((id) => id !== viewerId);
        return nextLikedBy;
      });
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
              username:
                (session.user as { username?: string | null })?.username ?? null,
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

  useEffect(() => {
    return () => {
      if (editCoverPreview) {
        URL.revokeObjectURL(editCoverPreview);
      }
    };
  }, [editCoverPreview]);

  const resizeImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = dataUrl;
    });

    const maxSize = 1200;
    let targetWidth = img.width;
    let targetHeight = img.height;
    if (targetWidth > targetHeight && targetWidth > maxSize) {
      targetHeight = Math.round((targetHeight * maxSize) / targetWidth);
      targetWidth = maxSize;
    } else if (targetHeight > maxSize) {
      targetWidth = Math.round((targetWidth * maxSize) / targetHeight);
      targetHeight = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Failed to compress image"));
          } else {
            resolve(result);
          }
        },
        "image/jpeg",
        0.84
      );
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  };

  const handleCoverChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const processed = await resizeImage(file);
      if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
      setEditCoverFile(processed);
      setEditCoverPreview(URL.createObjectURL(processed));
    } catch {
      // ignore
    } finally {
      event.target.value = "";
    }
  };

  const updateMutation = useMutation({
    mutationFn: async () => {
      let coverUrl: string | null = null;
      if (editCoverFile) {
        const signResponse = await fetch("/api/cloudinary/sign-faith-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1 }),
        });
        if (!signResponse.ok) {
          throw new Error("Failed to prepare upload");
        }
        const signData = (await signResponse.json()) as {
          cloudName: string;
          apiKey: string;
          upload: {
            publicId: string;
            signature: string;
            timestamp: number;
            folder: string;
            invalidate: string;
          };
        };
        const formData = new FormData();
        formData.append("file", editCoverFile);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", String(signData.upload.timestamp));
        formData.append("signature", signData.upload.signature);
        formData.append("folder", signData.upload.folder);
        formData.append("public_id", signData.upload.publicId);
        formData.append("invalidate", signData.upload.invalidate);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadResponse.ok) {
          throw new Error("Failed to upload cover image");
        }
        const uploaded = (await uploadResponse.json()) as {
          secure_url?: string;
          url?: string;
        };
        coverUrl = uploaded.secure_url ?? uploaded.url ?? null;
      }
      const response = await fetch(`/api/faith-stories/${story._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          coverImage: coverUrl ?? undefined,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to update story");
      }
      return (await response.json()) as { title: string; content: string };
    },
    onSuccess: () => {
      setIsEditing(false);
      if (editCoverPreview) {
        URL.revokeObjectURL(editCoverPreview);
      }
      setEditCoverPreview(null);
      setEditCoverFile(null);
      router.refresh();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (reason?: string) => {
      const response = await fetch(`/api/faith-stories/${story._id}`, {
        method: "DELETE",
        headers: reason ? { "Content-Type": "application/json" } : undefined,
        body: reason ? JSON.stringify({ reason }) : undefined,
      });
      if (!response.ok) {
        throw new Error("Failed to delete story");
      }
    },
    onSuccess: () => {
      queryClient.setQueriesData(
        {
          queryKey: ["faith-stories"],
        },
        (current: FaithStoryDetailProps["story"][] | undefined) => {
          if (!Array.isArray(current)) return current;
          return current.filter((item) => item._id !== story._id);
        }
      );
      queryClient.invalidateQueries({ queryKey: ["faith-stories"] });
      router.push("/faith-stories");
    },
  });
  const isDeleting = deleteMutation.isPending;

  const handleAdminDelete = async () => {
    if (!isAdmin || !adminReason) return;
    try {
      await deleteMutation.mutateAsync(adminReason);
    } catch (error) {
      console.error(error);
    }
  };

  const storyHref =
    story.user?.username ? `/faith-story/${story.user.username}/${story._id}` : null;

  const handleCopyLink = async () => {
    if (!storyHref) return;
    setShareError(null);
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}${storyHref}`
      );
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      setShareError("Failed to copy link.");
    }
  };

  const handleShareToFeed = async () => {
    if (!session?.user?.id) {
      setShareError("Sign in to share this story.");
      return;
    }
    setShareError(null);
    setIsSharing(true);
    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: shareText.trim(),
          sharedFaithStoryId: story._id,
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data?.error ?? "Failed to share story.");
      }
      const data = (await response.json()) as {
        _id: string;
        content?: string | null;
        createdAt?: string | Date;
        images?: string[];
        scriptureRef?: string | null;
      };
      queryClient.setQueriesData(
        { queryKey: ["words"] },
        (current: {
          pages?: Array<{ items: Array<Record<string, unknown>>; nextCursor?: string | null }>;
          pageParams?: Array<string | null>;
        } | undefined) => {
          if (!current?.pages?.length) return current;
          const firstPage = current.pages[0];
          const newWord = {
            ...data,
            _id: typeof data._id === "string" ? data._id : String(data._id),
            content: data.content ?? "",
            createdAt: data.createdAt ?? new Date().toISOString(),
            userId: session.user.id,
            user: {
              name: session.user.name ?? "User",
              image: session.user.image ?? null,
              username: (session.user as { username?: string | null }).username ?? null,
            },
            likedBy: [],
            savedBy: [],
            commentCount: 0,
            scriptureRef: data.scriptureRef ?? null,
            images: Array.isArray(data.images) ? data.images : [],
            sharedFaithStory: {
              id: story._id,
              title: story.title,
              coverImage: story.coverImage ?? null,
              authorUsername: story.user?.username ?? null,
            },
          };
          return {
            ...current,
            pages: [
              {
                ...firstPage,
                items: [newWord, ...firstPage.items],
              },
              ...current.pages.slice(1),
            ],
          };
        }
      );
      setShowShareModal(false);
      setShareText("");
      setShareCopied(false);
    } catch (error) {
      setShareError(error instanceof Error ? error.message : "Failed to share story.");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div>
      <PostBackHeader label="Faith Story" refreshOnBack />
      <div className="panel p-6 sm:p-8 rounded-none">
        <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
          <span>{formatFullDate(story.createdAt)}</span>
          {(isOwner || isAdmin) && (
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
                  {isOwner && (
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
                  )}
                  {isOwner && (
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
                  )}
                  {isAdmin && !isOwner && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        setAdminReason("");
                        setShowAdminDeleteConfirm(true);
                      }}
                      className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                    >
                      Admin Delete
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {!isEditing ? (
          <div className="mt-6 flex flex-col gap-6">
            {story.coverImage && (
              <div className="relative h-52 w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)]">
                <Image
                  src={cloudinaryTransform(story.coverImage, { width: 1200, height: 520 })}
                  alt=""
                  fill
                  sizes="(min-width: 768px) 720px, 100vw"
                  className="object-cover"
                />
              </div>
            )}
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
              {showFullContent || story.content.length <= 900
                ? story.content
                : `${story.content.slice(0, 900).trimEnd()}…`}
            </div>
            {story.content.length > 900 && (
              <button
                type="button"
                onClick={() => setShowFullContent((prev) => !prev)}
                className="text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                {showFullContent ? "Done" : "Continue"}
              </button>
            )}

            <div className="flex items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => likeMutation.mutate()}
                className="inline-flex items-center gap-2 text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                <Heart size={20} weight={hasLiked ? "fill" : "regular"} />
                {localLikedBy.length > 0 && (
                  <span className="text-xs font-semibold text-[color:var(--ink)]">
                    {localLikedBy.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                className="inline-flex items-center gap-2 text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
              >
                <ShareNetwork size={20} weight="regular" />
                {typeof story.sharedCount === "number" && story.sharedCount > 0 && (
                  <span className="text-xs font-semibold text-[color:var(--ink)]">
                    {story.sharedCount}
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
            <div className="flex items-center gap-3 text-xs text-[color:var(--subtle)]">
              <button
                type="button"
                onClick={() => coverInputRef.current?.click()}
                className="inline-flex items-center gap-2 font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
              >
                <ImageSquare size={18} weight="regular" />
                Change cover
              </button>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverChange}
              />
              {(editCoverPreview || story.coverImage) && (
                <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-[color:var(--panel-border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editCoverPreview ?? story.coverImage ?? ""}
                    alt="Cover preview"
                    className="h-full w-full object-cover"
                  />
                  {editCoverPreview && (
                    <button
                      type="button"
                      onClick={() => {
                        if (editCoverPreview) URL.revokeObjectURL(editCoverPreview);
                        setEditCoverPreview(null);
                        setEditCoverFile(null);
                      }}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                      aria-label="Remove cover image"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  )}
                </div>
              )}
            </div>
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
              className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none"
              placeholder="Write a comment..."
              value={commentText}
              onChange={(event) => {
                setCommentText(event.target.value);
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
              }}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                className="post-button"
                disabled={!commentText.trim()}
              >
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
                          className="bg-transparent comment-input min-h-[28px] text-sm text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none"
                          value={editingCommentText}
                          onChange={(event) => {
                            setEditingCommentText(event.target.value);
                            event.currentTarget.style.height = "auto";
                            event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
                          }}
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
        autoFocus={false}
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
              await deleteMutation.mutateAsync(undefined);
            }}
            disabled={isDeleting}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer disabled:opacity-60"
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
          Choose a reason for removing this story. The author will be notified.
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
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
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
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer disabled:opacity-60"
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>

      <Modal
        title="Share Faith Story"
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        autoFocus={false}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          Share this story to your Faith Share feed or copy the link.
        </p>
        <textarea
          className="mt-4 bg-transparent text-sm text-[color:var(--ink)] outline-none min-h-[80px] resize-none w-full border border-[color:var(--panel-border)] rounded-lg p-3 focus:outline-none focus:ring-0"
          placeholder="Add a message (optional)"
          value={shareText}
          onChange={(event) => setShareText(event.target.value)}
        />
        {shareError && (
          <p className="mt-2 text-xs text-[color:var(--danger)]">{shareError}</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2 justify-end">
          <button
            type="button"
            onClick={handleCopyLink}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] border border-[color:var(--panel-border)]"
            disabled={!storyHref}
          >
            {shareCopied ? "Copied" : "Copy link"}
          </button>
          <button
            type="button"
            onClick={handleShareToFeed}
            disabled={isSharing}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--accent-contrast)] bg-[color:var(--accent)] disabled:opacity-60"
          >
            {isSharing ? "Sharing..." : "Share to feed"}
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
