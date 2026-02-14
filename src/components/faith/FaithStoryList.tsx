"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, Plus, UserCircle } from "@phosphor-icons/react";
import Image from "next/image";
import { cloudinaryTransform } from "@/lib/cloudinary";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import Spinner from "@/components/ui/Spinner";
import { useUIStore } from "@/lib/uiStore";

const FaithStoryForm = dynamic(() => import("@/components/faith/FaithStoryForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

type FaithStory = {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
  user?: { name?: string | null; username?: string | null; image?: string | null } | null;
  userId?: string | null;
  commentCount?: number;
  authorUsername?: string | null;
  isAnonymous?: boolean;
  coverImage?: string | null;
};

const decodeIfEncoded = (value: string) => {
  if (!value) return "";
  if (value.includes("<")) return value;
  if (!value.includes("&lt;")) return value;
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
};

const stripHtml = (value: string) =>
  decodeIfEncoded(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export default function FaithStoryList() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { openSignIn } = useUIStore();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const createRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(id);
  }, [query]);

  const { data: stories = [], isLoading } = useQuery({
    queryKey: ["faith-stories", debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced.trim()) params.set("q", debounced.trim());
      const queryKey = params.toString();
      const etagKey = `faith-stories-etag:${queryKey || "all"}`;
      const headers = new Headers();
      if (typeof window !== "undefined") {
        const stored = window.localStorage.getItem(etagKey);
        if (stored) {
          headers.set("If-None-Match", stored);
        }
      }
      const response = await fetch(`/api/faith-stories?${queryKey}`, {
        cache: "no-store",
        headers,
      });
      if (response.status === 304) {
        const cached = queryClient.getQueryData<FaithStory[]>([
          "faith-stories",
          debounced,
        ]);
        if (cached && cached.length > 0) {
          return cached;
        }
        const retry = await fetch(`/api/faith-stories?${queryKey}`, {
          cache: "no-store",
        });
        if (!retry.ok) {
          throw new Error("Failed to load stories");
        }
        const retryData = (await retry.json()) as FaithStory[];
        const retryEtag = retry.headers.get("ETag");
        if (retryEtag && typeof window !== "undefined") {
          window.localStorage.setItem(etagKey, retryEtag);
        }
        return retryData.map((item) => ({
          ...item,
          _id: typeof item._id === "string" ? item._id : String(item._id),
          coverImage: item.coverImage ?? null,
        }));
      }
      if (!response.ok) {
        throw new Error("Failed to load stories");
      }
      const etag = response.headers.get("ETag");
      if (etag && typeof window !== "undefined") {
        window.localStorage.setItem(etagKey, etag);
      }
      const data = (await response.json()) as FaithStory[];
      return data.map((item) => ({
        ...item,
        _id: typeof item._id === "string" ? item._id : String(item._id),
        coverImage: item.coverImage ?? null,
      }));
    },
    staleTime: 120000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: async ({
      title,
      content,
      isAnonymous,
      coverImage,
    }: {
      title: string;
      content: string;
      isAnonymous: boolean;
      coverImage?: string | null;
    }) => {
      const response = await fetch("/api/faith-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, isAnonymous, coverImage }),
      });
      if (!response.ok) {
        throw new Error("Failed to create story");
      }
      return (await response.json()) as FaithStory;
    },
    onSuccess: async (story) => {
      setShowCreate(false);
      setIsDirty(false);
      const normalized = {
        ...story,
        _id: typeof story._id === "string" ? story._id : String(story._id),
        coverImage: story.coverImage ?? null,
      } as FaithStory;
      const queryText = debounced.trim().toLowerCase();
      const matchesQuery = queryText
        ? [
            normalized.title ?? "",
            normalized.content ?? "",
            normalized.user?.name ?? "",
            normalized.user?.username ?? "",
            normalized.authorUsername ?? "",
          ]
            .join(" ")
            .toLowerCase()
            .includes(queryText)
        : true;
      if (matchesQuery) {
        queryClient.setQueriesData<FaithStory[]>(
          { queryKey: ["faith-stories"] },
          (current) => {
            if (!Array.isArray(current)) return current ?? [normalized];
            if (current.some((item) => item._id === normalized._id)) {
              return current;
            }
            return [normalized, ...current];
          }
        );
      }
      if (typeof window !== "undefined") {
        const keysToRemove: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (key && key.startsWith("faith-stories-etag:")) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((key) => window.localStorage.removeItem(key));
      }
      await queryClient.invalidateQueries({ queryKey: ["faith-stories"] });
      const username = story.authorUsername ?? story.user?.username;
      if (username) {
        router.push(`/faith-story/${username}/${story._id}`);
      }
    },
  });

  useEffect(() => {
    if (!showCreate) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (createRef.current?.contains(target)) return;
      if (showDiscardConfirm) return;

      if (isDirty) {
        setPendingAction(() => () => {
          setShowCreate(false);
          setIsDirty(false);
        });
        setShowDiscardConfirm(true);
      } else {
        setShowCreate(false);
        setIsDirty(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showCreate, isDirty, showDiscardConfirm]);

  const results = useMemo(() => stories, [stories]);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Faith Stories</h1>
            <p className="text-sm text-[color:var(--subtle)]">
              Public stories shared by the community.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                openSignIn();
                return;
              }
              setShowCreate(true);
            }}
            className="text-[color:var(--ink)] hover:text-[color:var(--accent)] inline-flex items-center justify-center"
            aria-label="New story"
          >
            <Plus size={22} weight="regular" />
          </button>
        </div>
        <div className="w-full max-w-2xl">
          <div className="soft-input text-sm w-full flex items-center gap-2 px-3">
            <span className="text-[color:var(--subtle)]">
              <MagnifyingGlass size={18} weight="regular" />
            </span>
            <input
              className="bg-transparent w-full text-sm focus:outline-none"
              placeholder="Search stories..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>
      </div>

      {showCreate ? (
        <div ref={createRef} className="panel p-6 sm:p-8 rounded-none">
          <FaithStoryForm
            submitLabel="Publish"
            onSubmit={async (title, content, isAnonymous, coverImage) => {
              await createMutation.mutateAsync({
                title,
                content,
                isAnonymous,
                coverImage,
              });
            }}
            onCancel={() => {
              if (isDirty) {
                setPendingAction(() => () => {
                  setShowCreate(false);
                  setIsDirty(false);
                });
                setShowDiscardConfirm(true);
                return;
              }
              setShowCreate(false);
              setIsDirty(false);
            }}
            onDirtyChange={setIsDirty}
          />
        </div>
      ) : isLoading ? (
        <div className="panel p-6 text-sm text-[color:var(--subtle)]">Loading...</div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No faith stories yet."
          description="Share a story to encourage others."
        />
      ) : (
        <div className="flex flex-col gap-4">
          {results.map((story) => {
            const username = story.authorUsername ?? story.user?.username ?? "";
            const displayName = story.isAnonymous ? "Anonymous" : story.user?.name ?? "User";
            return (
              <button
                key={story._id}
                type="button"
                onClick={() => {
                  if (!username) return;
                  router.push(`/faith-story/${username}/${story._id}`);
                }}
                className="panel p-6 text-left flex flex-col gap-3 cursor-pointer hover:border-[color:var(--accent)]"
              >
                <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
                  <div className="flex items-center gap-2">
                    {story.isAnonymous ? (
                      <div className="h-8 w-8 rounded-full bg-[color:var(--surface-strong)] flex items-center justify-center">
                        <UserCircle size={20} weight="regular" />
                      </div>
                    ) : (
                      <Avatar
                        src={story.user?.image ?? null}
                        alt={displayName}
                        size={32}
                        href={username ? `/profile/${username}` : "/profile"}
                        fallback={(displayName[0] ?? "U").toUpperCase()}
                        className="h-8 w-8 text-[11px]"
                      />
                    )}
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-[color:var(--ink)]">
                        {displayName}
                      </p>
                      {!story.isAnonymous && username && (
                        <p className="text-[10px] text-[color:var(--subtle)]">
                          @{username}
                        </p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px]">
                    {new Date(story.createdAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                {story.coverImage && (
                  <div className="relative h-36 w-full overflow-hidden rounded-2xl border border-[color:var(--panel-border)]">
                    <Image
                      src={cloudinaryTransform(story.coverImage, {
                        width: 900,
                        height: 390,
                        autoOrient: false,
                      })}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 640px, 100vw"
                      className="object-cover"
                    />
                  </div>
                )}
                <h2 className="text-lg font-semibold text-[color:var(--ink)] text-center">
                  {story.title}
                </h2>
                <p className="text-sm text-[color:var(--subtle)] line-clamp-4 whitespace-pre-line">
                  {stripHtml(story.content)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <Modal
        title="Discard story?"
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved changes. Discard them?
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDiscardConfirm(false);
              pendingAction?.();
              setPendingAction(null);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Discard
          </button>
        </div>
      </Modal>
    </section>
  );
}
