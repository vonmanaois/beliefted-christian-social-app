"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import EmptyState from "@/components/ui/EmptyState";
import Avatar from "@/components/ui/Avatar";
import Modal from "@/components/layout/Modal";
import Spinner from "@/components/ui/Spinner";

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
};

export default function FaithStoryList() {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const router = useRouter();
  const queryClient = useQueryClient();
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
      const response = await fetch(`/api/faith-stories?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load stories");
      }
      const data = (await response.json()) as FaithStory[];
      return data.map((item) => ({
        ...item,
        _id: typeof item._id === "string" ? item._id : String(item._id),
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const response = await fetch("/api/faith-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        throw new Error("Failed to create story");
      }
      return (await response.json()) as FaithStory;
    },
    onSuccess: async (story) => {
      setShowCreate(false);
      setIsDirty(false);
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
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="text-[color:var(--ink)] hover:text-[color:var(--accent)] inline-flex items-center justify-center"
              aria-label="New story"
            >
              <Plus size={22} weight="regular" />
            </button>
          )}
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
            onSubmit={async (title, content) => {
              await createMutation.mutateAsync({ title, content });
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
            const username = story.user?.username ?? "";
            const displayName = story.user?.name ?? "User";
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
                    <Avatar
                      src={story.user?.image ?? null}
                      alt={displayName}
                      size={32}
                      href={username ? `/profile/${username}` : "/profile"}
                      fallback={(displayName[0] ?? "U").toUpperCase()}
                      className="h-8 w-8 text-[11px]"
                    />
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-[color:var(--ink)]">
                        {displayName}
                      </p>
                      {username && (
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
                <h2 className="text-lg font-semibold text-[color:var(--ink)] text-center">
                  {story.title}
                </h2>
                <p className="text-sm text-[color:var(--subtle)] line-clamp-4">
                  {story.content}
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
