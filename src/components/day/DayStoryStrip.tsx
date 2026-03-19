"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Eye, Heart, Trash, CaretLeft, CaretRight } from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import Avatar from "@/components/ui/Avatar";
import { cloudinaryTransform } from "@/lib/cloudinary";

type DayStoryUser = {
  name?: string | null;
  username?: string | null;
  image?: string | null;
};

type DayStoryItem = {
  _id: string;
  userId: string;
  imageUrl: string;
  createdAt: string;
  expiresAt: string;
  user?: DayStoryUser | null;
  isOwner?: boolean;
  viewCount?: number;
  hasViewed?: boolean;
  likeCount?: number;
  hasLiked?: boolean;
};

type ViewerItem = {
  user?: DayStoryUser | null;
  viewedAt: string;
};

type StoryGroup = {
  userId: string;
  user?: DayStoryUser | null;
  stories: DayStoryItem[];
  hasUnviewed: boolean;
};

const STORY_DURATION_MS = 18_000;
const MAX_STORY_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_RAW_STORY_BYTES = 25 * 1024 * 1024;
const MAX_STORY_DIMENSION = 1600;
const ACCEPTED_STORY_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

const formatStoryAge = (createdAt: string) => {
  const diffMs = Math.max(Date.now() - new Date(createdAt).getTime(), 0);
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes <= 0) return "Just posted";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

const readImageFile = async (file: File) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new window.Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image"));
    };
    image.src = objectUrl;
  });

const canvasToBlob = async (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Failed to compress image"));
          return;
        }
        resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });

const prepareStoryImage = async (file: File) => {
  if (!ACCEPTED_STORY_TYPES.has(file.type)) {
    throw new Error(
      "Unsupported file type. Please choose a JPG, PNG, or WEBP image for your story."
    );
  }
  if (file.size > MAX_RAW_STORY_BYTES) {
    throw new Error("This image is too large. Please choose one under 25MB.");
  }

  const image = await readImageFile(file);
  const largestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = largestSide > MAX_STORY_DIMENSION ? MAX_STORY_DIMENSION / largestSide : 1;
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Image processing is not available on this device.");
  }

  context.fillStyle = "#000000";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  const qualities = [0.86, 0.78, 0.7, 0.62, 0.54];
  let outputBlob: Blob | null = null;
  for (const quality of qualities) {
    const blob = await canvasToBlob(canvas, quality);
    outputBlob = blob;
    if (blob.size <= MAX_STORY_UPLOAD_BYTES) break;
  }

  if (!outputBlob || outputBlob.size > MAX_STORY_UPLOAD_BYTES) {
    throw new Error(
      "We couldn't optimize this image enough for story upload. Please use a smaller photo."
    );
  }

  const extension = file.name.split(".").pop() ?? "jpg";
  const normalizedName = file.name.replace(new RegExp(`\\.${extension}$`, "i"), "") || "story";
  return new File([outputBlob], `${normalizedName}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
};

export default function DayStoryStrip() {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [storyFile, setStoryFile] = useState<File | null>(null);
  const [storyPreview, setStoryPreview] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createBusy, setCreateBusy] = useState(false);
  const [prepareBusy, setPrepareBusy] = useState(false);
  const [activeGroupIndex, setActiveGroupIndex] = useState<number | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);
  const [showViewers, setShowViewers] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const advanceTimerRef = useRef<number | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const swipeStartXRef = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  const [storyImageError, setStoryImageError] = useState(false);
  const [optimisticViewedIds, setOptimisticViewedIds] = useState<string[]>([]);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    return () => {
      if (storyPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(storyPreview);
      }
    };
  }, [storyPreview]);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["day-stories"],
    queryFn: async () => {
      const response = await fetch("/api/day-stories", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load stories");
      }
      return (await response.json()) as DayStoryItem[];
    },
  });

  const orderedStories = useMemo(() => {
    return [...stories].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [stories]);

  const groupedStories = useMemo<StoryGroup[]>(() => {
    const groups = new Map<string, StoryGroup>();
    orderedStories.forEach((story) => {
      const key = story.userId;
      const existing = groups.get(key);
      if (existing) {
        existing.stories.push(story);
        existing.hasUnviewed ||= !story.isOwner && !story.hasViewed;
        return;
      }
      groups.set(key, {
        userId: key,
        user: story.user ?? null,
        stories: [story],
        hasUnviewed: !story.isOwner && !story.hasViewed,
      });
    });
    return Array.from(groups.values()).map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ),
    }));
  }, [orderedStories]);

  const activeGroup =
    activeGroupIndex !== null && groupedStories[activeGroupIndex]
      ? groupedStories[activeGroupIndex]
      : null;

  const activeStory =
    activeGroup && activeGroup.stories[activeStoryIndex]
      ? activeGroup.stories[activeStoryIndex]
      : null;

  useEffect(() => {
    if (!activeStory) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeStory]);

  useEffect(() => {
    setStoryImageError(false);
  }, [activeStory?._id]);

  useEffect(() => {
    if (!activeGroup) {
      setActiveStoryIndex(0);
      return;
    }
    if (activeStoryIndex >= activeGroup.stories.length) {
      setActiveStoryIndex(0);
    }
  }, [activeGroup, activeStoryIndex]);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (activeGroupIndex === null) {
      setShowViewers(false);
      return;
    }
    if (activeGroupIndex >= groupedStories.length) {
      setActiveGroupIndex(null);
    }
  }, [activeGroupIndex, groupedStories.length]);

  useEffect(() => {
    if (advanceTimerRef.current !== null) {
      window.clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = null;
    }
    if (!activeGroup || !activeStory || isPaused) return;
    advanceTimerRef.current = window.setTimeout(() => {
      setActiveStoryIndex((currentStoryIndex) => {
        if (!activeGroup) return currentStoryIndex;
        if (currentStoryIndex + 1 < activeGroup.stories.length) {
          return currentStoryIndex + 1;
        }
        setActiveGroupIndex((currentGroupIndex) => {
          if (currentGroupIndex === null) return null;
          const nextGroup = currentGroupIndex + 1;
          if (nextGroup >= groupedStories.length) {
            return null;
          }
          return nextGroup;
        });
        return 0;
      });
    }, STORY_DURATION_MS);
    return () => {
      if (advanceTimerRef.current !== null) {
        window.clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, [activeGroup, activeStory, groupedStories.length, isPaused]);

  useEffect(() => {
    if (!activeStory || activeStory.isOwner) return;
    setOptimisticViewedIds((current) =>
      current.includes(activeStory._id) ? current : [...current, activeStory._id]
    );
    const markViewed = async () => {
      await fetch(`/api/day-stories/${activeStory._id}/view`, { method: "POST" });
    };
    void markViewed();
    queryClient.setQueryData<DayStoryItem[]>(["day-stories"], (current = []) =>
      current.map((item) =>
        item._id === activeStory._id
          ? {
              ...item,
              hasViewed: true,
              viewCount: (item.viewCount ?? 0) + (item.hasViewed ? 0 : 1),
            }
          : item
      )
    );
  }, [activeStory, queryClient]);

  const storyMutation = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await fetch("/api/day-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to post story");
      }
      return (await response.json()) as { id: string };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-stories"] });
      setShowCreate(false);
      setStoryFile(null);
      if (storyPreview?.startsWith("blob:")) {
        URL.revokeObjectURL(storyPreview);
      }
      setStoryPreview(null);
      setCreateError(null);
    },
    onError: (error) => {
      setCreateError((error as Error)?.message ?? "Failed to post story");
    },
  });

  const likeMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const response = await fetch(`/api/day-stories/${storyId}/like`, { method: "POST" });
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event("open-signin"));
        }
        throw new Error("Failed to like story");
      }
      return (await response.json()) as { liked: boolean; likeCount: number };
    },
    onSuccess: (data, storyId) => {
      queryClient.setQueryData<DayStoryItem[]>(["day-stories"], (current = []) =>
        current.map((story) =>
          story._id === storyId
            ? { ...story, hasLiked: data.liked, likeCount: data.likeCount }
            : story
        )
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (storyId: string) => {
      const response = await fetch(`/api/day-stories/${storyId}`, { method: "DELETE" });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error ?? "Failed to delete story");
      }
      return storyId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["day-stories"] });
      setActiveGroupIndex(null);
    },
  });

  const viewersQuery = useQuery({
    queryKey: ["day-story-viewers", activeStory?._id],
    queryFn: async () => {
      if (!activeStory?._id) return [];
      const response = await fetch(`/api/day-stories/${activeStory._id}/viewers`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load viewers");
      }
      return (await response.json()) as ViewerItem[];
    },
    enabled: showViewers && Boolean(activeStory?._id),
  });

  const uploadStory = async () => {
    if (!storyFile) return null;
    const response = await fetch("/api/cloudinary/sign-day-story", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (!response.ok) {
      throw new Error("Failed to prepare upload");
    }
    const payload = (await response.json()) as {
      cloudName: string;
      apiKey: string;
      uploads: {
        publicId: string;
        signature: string;
        timestamp: number;
        folder: string;
        invalidate: string;
      }[];
    };
    const upload = payload.uploads?.[0];
    if (!upload) {
      throw new Error("Upload config missing");
    }
    const formData = new FormData();
    formData.append("file", storyFile);
    formData.append("api_key", payload.apiKey);
    formData.append("timestamp", String(upload.timestamp));
    formData.append("signature", upload.signature);
    formData.append("folder", upload.folder);
    formData.append("public_id", upload.publicId);
    formData.append("invalidate", upload.invalidate);
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${payload.cloudName}/image/upload`,
      { method: "POST", body: formData }
    );
    if (!uploadResponse.ok) {
      throw new Error("Upload failed");
    }
    const data = (await uploadResponse.json()) as { secure_url?: string };
    return data.secure_url ?? null;
  };

  const handleOpenStoryGroup = (group: StoryGroup) => {
    const groupIndex = groupedStories.findIndex((item) => item.userId === group.userId);
    const firstUnviewedIndex = group.stories.findIndex(
      (story) => !story.isOwner && !story.hasViewed
    );
    setIsPaused(false);
    setActiveGroupIndex(groupIndex >= 0 ? groupIndex : 0);
    setActiveStoryIndex(firstUnviewedIndex >= 0 ? firstUnviewedIndex : 0);
  };

  const goToPreviousStory = () => {
    if (!activeGroup) return;
    setIsPaused(false);
    if (activeStoryIndex > 0) {
      setActiveStoryIndex((current) => current - 1);
      return;
    }
    setActiveGroupIndex((currentGroupIndex) => {
      if (currentGroupIndex === null || currentGroupIndex === 0) return currentGroupIndex;
      const previousGroupIndex = currentGroupIndex - 1;
      const previousGroup = groupedStories[previousGroupIndex];
      setActiveStoryIndex(Math.max(previousGroup.stories.length - 1, 0));
      return previousGroupIndex;
    });
  };

  const goToNextStory = () => {
    if (!activeGroup) return;
    setIsPaused(false);
    if (activeStoryIndex + 1 < activeGroup.stories.length) {
      setActiveStoryIndex((current) => current + 1);
      return;
    }
    setActiveGroupIndex((currentGroupIndex) => {
      if (currentGroupIndex === null) return null;
      const nextGroupIndex = currentGroupIndex + 1;
      if (nextGroupIndex >= groupedStories.length) return null;
      setActiveStoryIndex(0);
      return nextGroupIndex;
    });
  };

  const jumpToStory = (index: number) => {
    if (!activeGroup) return;
    setIsPaused(false);
    setActiveStoryIndex(Math.max(0, Math.min(index, activeGroup.stories.length - 1)));
  };

  const startLongPressPause = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
    }
    holdTimerRef.current = window.setTimeout(() => {
      setIsPaused(true);
      holdTimerRef.current = null;
    }, 180);
  };

  const stopLongPressPause = () => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    setIsPaused(false);
  };

  const handlePointerStart = (clientX: number) => {
    swipeStartXRef.current = clientX;
    swipeHandledRef.current = false;
    startLongPressPause();
  };

  const handlePointerMove = (clientX: number) => {
    if (swipeStartXRef.current === null || swipeHandledRef.current) return;
    const deltaX = clientX - swipeStartXRef.current;
    if (Math.abs(deltaX) < 48) return;
    swipeHandledRef.current = true;
    stopLongPressPause();
    if (deltaX > 0) {
      goToPreviousStory();
      return;
    }
    goToNextStory();
  };

  const handlePointerEnd = () => {
    swipeStartXRef.current = null;
    swipeHandledRef.current = false;
    stopLongPressPause();
  };

  return (
    <>
      <div className="flex items-center gap-3 overflow-x-auto pb-3">
        <button
          type="button"
          onClick={() => {
            if (!isAuthenticated) {
              window.dispatchEvent(new Event("open-signin"));
              return;
            }
            setShowCreate(true);
          }}
          className="flex flex-col items-center gap-2 min-w-[76px]"
        >
          <div className="h-14 w-14 rounded-full border border-dashed border-[color:var(--panel-border)] flex items-center justify-center bg-[color:var(--surface)]">
            <Plus size={18} className="text-[color:var(--subtle)]" />
          </div>
          <span className="text-[11px] text-[color:var(--subtle)]">My Day</span>
        </button>
        {isLoading ? (
          <div className="text-xs text-[color:var(--subtle)]">Loading stories...</div>
        ) : (
          groupedStories.map((group) => {
            const previewStory = group.stories[group.stories.length - 1];
            const isViewed = group.stories.every(
              (story) =>
                story.isOwner || story.hasViewed || optimisticViewedIds.includes(story._id)
            );
            const viewedCount = group.stories.filter(
              (story) =>
                story.isOwner || story.hasViewed || optimisticViewedIds.includes(story._id)
            ).length;
            const progressRatio =
              group.stories.length > 0 ? viewedCount / group.stories.length : 0;
            return (
              <button
                key={group.userId}
                type="button"
                onClick={() => handleOpenStoryGroup(group)}
                className="flex flex-col items-center gap-2 min-w-[76px]"
              >
                <div
                  className="relative h-14 w-14 rounded-full p-[2px]"
                  style={{
                    background: isViewed
                      ? "rgba(255,255,255,0.08)"
                      : `conic-gradient(#60a5fa ${progressRatio * 360}deg, rgba(255,255,255,0.12) 0deg)`,
                    opacity: isViewed ? 0.58 : 1,
                    boxShadow: isViewed ? "none" : "0 0 0 2px rgba(96, 165, 250, 0.22)",
                  }}
                >
                  <div className="h-full w-full rounded-full overflow-hidden bg-[color:var(--surface)] p-[2px]">
                    <Avatar
                      src={group.user?.image ?? null}
                      alt={group.user?.name ?? "User"}
                      size={56}
                      fallback={(group.user?.name?.[0] ?? "U").toUpperCase()}
                      className="h-full w-full text-xs"
                    />
                  </div>
                  {!isViewed ? (
                    <span className="absolute right-0 top-0 h-3.5 w-3.5 rounded-full border-2 border-[color:var(--panel)] bg-sky-400 shadow-[0_0_0_4px_rgba(96,165,250,0.18)]" />
                  ) : null}
                </div>
                <span className="text-[11px] text-[color:var(--subtle)]">
                  {group.user?.username
                    ? `@${group.user.username}`
                    : previewStory.user?.name ?? "Story"}
                </span>
              </button>
            );
          })
        )}
      </div>

      <Modal title="My Day Story" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <div className="flex flex-col gap-3">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (event) => {
              const input = event.currentTarget;
              const rawFile = event.target.files?.[0] ?? null;
              if (!rawFile) {
                setStoryFile(null);
                if (storyPreview?.startsWith("blob:")) {
                  URL.revokeObjectURL(storyPreview);
                }
                setStoryPreview(null);
                return;
              }
              setPrepareBusy(true);
              setCreateError(null);
              try {
                const preparedFile = await prepareStoryImage(rawFile);
                if (storyPreview?.startsWith("blob:")) {
                  URL.revokeObjectURL(storyPreview);
                }
                setStoryFile(preparedFile);
                setStoryPreview(URL.createObjectURL(preparedFile));
              } catch (error) {
                setStoryFile(null);
                if (storyPreview?.startsWith("blob:")) {
                  URL.revokeObjectURL(storyPreview);
                }
                setStoryPreview(null);
                setCreateError((error as Error).message);
              } finally {
                setPrepareBusy(false);
                input.value = "";
              }
            }}
          />
          {storyPreview ? (
            <div className="relative h-56 w-full overflow-hidden rounded-xl border border-[color:var(--panel-border)]">
              <Image
                src={
                  storyPreview.startsWith("blob:")
                    ? storyPreview
                    : cloudinaryTransform(storyPreview, { width: 900, height: 600 })
                }
                alt="Story preview"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
          ) : null}
          {storyFile ? (
            <p className="text-xs text-[color:var(--subtle)]">
              Optimized before upload: {(storyFile.size / (1024 * 1024)).toFixed(2)}MB
            </p>
          ) : null}
          {createError ? <p className="text-xs text-[color:var(--subtle)]">{createError}</p> : null}
          <button
            type="button"
            disabled={createBusy || prepareBusy || !storyFile}
            onClick={async () => {
              if (!storyFile) return;
              setCreateBusy(true);
              setCreateError(null);
              try {
                const url = await uploadStory();
                if (!url) {
                  throw new Error("Upload failed");
                }
                await storyMutation.mutateAsync(url);
              } catch (error) {
                setCreateError((error as Error)?.message ?? "Failed to post story");
              } finally {
                setCreateBusy(false);
              }
            }}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] disabled:opacity-60"
          >
            {prepareBusy ? "Optimizing..." : createBusy ? "Posting..." : "Post Story"}
          </button>
        </div>
      </Modal>

      {portalReady && activeStory
        ? createPortal(
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/95"
              onClick={() => {
                setIsPaused(false);
                setActiveGroupIndex(null);
              }}
            >
              <div
                className="relative h-[100dvh] w-full overflow-hidden bg-black md:h-[min(85vh,820px)] md:w-[min(430px,92vw)] md:rounded-[28px] md:border md:border-white/10 md:shadow-2xl"
                style={{ paddingTop: "env(safe-area-inset-top)" }}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={(event) => handlePointerStart(event.clientX)}
                onPointerMove={(event) => handlePointerMove(event.clientX)}
                onPointerUp={handlePointerEnd}
                onPointerCancel={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
              >
                <div className="absolute inset-x-0 top-0 z-20 flex gap-1 px-3 pt-[max(12px,env(safe-area-inset-top))] md:pt-3">
                  {activeGroup?.stories.map((story, index) => {
                    const isCompleted = index < activeStoryIndex;
                    const isActive = story._id === activeStory._id;
                    return (
                      <button
                        key={story._id}
                        type="button"
                        onClick={() => jumpToStory(index)}
                        className="h-1 flex-1 overflow-hidden rounded-full bg-white/20"
                        aria-label={`Go to story ${index + 1}`}
                      >
                        <div
                          className={`h-full rounded-full ${
                            isCompleted ? "w-full bg-white" : isActive ? "story-progress-bar bg-white" : "w-0"
                          }`}
                          style={
                            isActive
                              ? ({
                                  animationDuration: `${STORY_DURATION_MS}ms`,
                                  animationPlayState: isPaused ? "paused" : "running",
                                } as CSSProperties)
                              : undefined
                          }
                        />
                      </button>
                    );
                  })}
                </div>
                <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/80 to-transparent" />
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={
                    storyImageError
                      ? activeStory.imageUrl
                      : cloudinaryTransform(activeStory.imageUrl, {
                          width: 1080,
                          height: 1920,
                          crop: "fit",
                          quality: "q_auto:good",
                          format: "f_auto",
                          autoOrient: true,
                        })
                  }
                  alt="Story"
                  className="absolute inset-0 h-full w-full object-contain bg-black"
                  onError={() => setStoryImageError(true)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-[5] w-1/2 bg-transparent"
                  aria-label="Previous story area"
                  onClick={goToPreviousStory}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-[5] w-1/2 bg-transparent"
                  aria-label="Next story area"
                  onClick={goToNextStory}
                />
                <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between gap-3 px-4 pb-4 pt-[calc(env(safe-area-inset-top)+12px)] text-white">
                  <div className="flex items-center gap-2 text-sm rounded-full bg-black/50 px-3 py-2 backdrop-blur">
                    <Avatar
                      src={activeStory.user?.image ?? null}
                      alt={activeStory.user?.name ?? "User"}
                      size={32}
                      fallback={(activeStory.user?.name?.[0] ?? "U").toUpperCase()}
                      className="h-8 w-8 text-[10px]"
                    />
                    <div>
                      <p className="text-sm font-semibold">
                        {activeStory.user?.name ?? "Story"}
                      </p>
                      <p className="text-[11px] text-white/70">
                        {activeStory.user?.username ? `@${activeStory.user.username}` : "Story"}{" "}
                        <span className="ml-1">{formatStoryAge(activeStory.createdAt)}</span>
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPaused(false);
                      setActiveGroupIndex(null);
                    }}
                    className="h-9 w-9 rounded-full bg-black/70 text-white shadow-md"
                    aria-label="Close story"
                  >
                    ✕
                  </button>
                </div>
                <button
                  type="button"
                  onClick={goToPreviousStory}
                  className="absolute left-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-30 md:flex"
                  disabled={activeGroupIndex === 0 && activeStoryIndex === 0}
                  aria-label="Previous story"
                >
                  <CaretLeft size={22} weight="bold" />
                </button>
                <button
                  type="button"
                  onClick={goToNextStory}
                  className="absolute right-2 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur disabled:opacity-30 md:flex"
                  disabled={
                    activeGroupIndex === groupedStories.length - 1 &&
                    activeStoryIndex === (activeGroup?.stories.length ?? 1) - 1
                  }
                  aria-label="Next story"
                >
                  <CaretRight size={22} weight="bold" />
                </button>
                <div
                  className="absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+20px)] pt-3 text-white"
                >
                  <div className="flex items-center gap-4 text-sm rounded-full bg-black/50 px-3 py-2 backdrop-blur">
                    <span className="inline-flex items-center gap-1">
                      <Eye size={16} /> {activeStory.viewCount ?? 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => likeMutation.mutate(activeStory._id)}
                      className={`inline-flex items-center gap-1 ${
                        activeStory.hasLiked ? "text-rose-400" : "text-white"
                      }`}
                    >
                      <Heart size={16} weight={activeStory.hasLiked ? "fill" : "regular"} />{" "}
                      {activeStory.likeCount ?? 0}
                    </button>
                  </div>
                  {activeStory.isOwner ? (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowViewers(true)}
                        className="rounded-full border border-white/40 bg-black/60 px-3 py-1 text-xs font-semibold text-white backdrop-blur"
                      >
                        Viewers
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteMutation.mutate(activeStory._id)}
                        className="rounded-full border border-white/40 bg-black/60 px-3 py-1 text-xs font-semibold text-white inline-flex items-center gap-1 backdrop-blur"
                      >
                        <Trash size={12} />
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {showViewers && activeStory
        ? createPortal(
        <div
          className="fixed inset-0 z-[10020] flex items-end justify-center bg-black/70 sm:items-center"
          onClick={() => setShowViewers(false)}
        >
          <div
            className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl bg-[color:var(--panel)] p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[color:var(--ink)]">Story viewers</h3>
              <button
                type="button"
                onClick={() => setShowViewers(false)}
                className="h-8 w-8 rounded-full text-[color:var(--subtle)]"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 max-h-[50vh] overflow-y-auto pr-1">
              {viewersQuery.isLoading ? (
                <p className="text-sm text-[color:var(--subtle)]">Loading viewers...</p>
              ) : viewersQuery.data?.length ? (
                <div className="flex flex-col gap-3">
                  {viewersQuery.data.map((viewer, index) => (
                    <div key={`${viewer.user?.username ?? "viewer"}-${index}`} className="flex items-center gap-3">
                      <Avatar
                        src={viewer.user?.image ?? null}
                        alt={viewer.user?.name ?? "Viewer"}
                        size={36}
                        href={viewer.user?.username ? `/profile/${viewer.user.username}` : "/profile"}
                        fallback={(viewer.user?.name?.[0] ?? "U").toUpperCase()}
                        className="h-8 w-8 text-xs"
                      />
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">
                          {viewer.user?.name ?? "Viewer"}
                        </p>
                        {viewer.user?.username ? (
                          <p className="text-xs text-[color:var(--subtle)]">@{viewer.user.username}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-[color:var(--subtle)]">No viewers yet.</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )
        : null}
    </>
  );
}
