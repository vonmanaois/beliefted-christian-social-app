"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DotsThreeOutline, Plus } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import Modal from "@/components/layout/Modal";
import EmptyState from "@/components/ui/EmptyState";
import Spinner from "@/components/ui/Spinner";

const JournalForm = dynamic(() => import("@/components/journal/JournalForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

type Journal = {
  _id: string;
  title: string;
  content: string;
  createdAt: string;
};

const formatCardDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

const getMonthLabel = (date: Date) => {
  const currentYear = new Date().getFullYear();
  const month = date.toLocaleDateString("en-US", { month: "long" });
  return date.getFullYear() === currentYear ? month : `${month}, ${date.getFullYear()}`;
};

export default function JournalBoard() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const createRef = useRef<HTMLDivElement | null>(null);

  const { data: journals = [], isLoading } = useQuery({
    queryKey: ["journals"],
    queryFn: async () => {
      const response = await fetch("/api/journals", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load journals");
      }
      const data = (await response.json()) as Journal[];
      return data.map((item) => ({
        ...item,
        _id: typeof item._id === "string" ? item._id : String(item._id),
      }));
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const response = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        throw new Error("Failed to create journal");
      }
      return (await response.json()) as Journal;
    },
    onSuccess: async () => {
      setShowCreate(false);
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/journals/${id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error("Failed to delete journal");
      }
    },
    onSuccess: async () => {
      setShowDeleteConfirm(false);
      setPendingDeleteId(null);
      await queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  const todayKey = new Date().toDateString();

  const { todayItems, grouped } = useMemo(() => {
    const todayItems = journals.filter(
      (item) => new Date(item.createdAt).toDateString() === todayKey
    );

    const grouped = new Map<string, Journal[]>();
    journals.forEach((item) => {
      if (new Date(item.createdAt).toDateString() === todayKey) return;
      const date = new Date(item.createdAt);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = grouped.get(key) ?? [];
      grouped.set(key, [...existing, item]);
    });

    return { todayItems, grouped };
  }, [journals, todayKey]);

  const sortedGroups = useMemo(() => {
    const entries = Array.from(grouped.entries());
    return entries.sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [grouped]);

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

  useEffect(() => {
    if (!menuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-journal-menu]")) return;
      setMenuId(null);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuId]);

  const renderGrid = (items: Journal[]) => (
    <div className="flex flex-col gap-4">
      {items.map((journal) => (
        <button
          key={journal._id}
          type="button"
          onClick={() => {
            if (showCreate && isDirty) {
              setPendingAction(() => () => {
                setShowCreate(false);
                setIsDirty(false);
              });
              setShowDiscardConfirm(true);
              return;
            }
            router.push(`/journal/${journal._id}`);
          }}
          className="panel p-5 text-left flex flex-col justify-between cursor-pointer hover:border-[color:var(--accent)] min-h-[180px] max-h-[260px]"
        >
          <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
            <span>{formatCardDate(journal.createdAt)}</span>
            <div className="relative" data-journal-menu>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setMenuId((prev) => (prev === journal._id ? null : journal._id));
                }}
                className="h-7 w-7 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                aria-label="Journal actions"
              >
                <DotsThreeOutline size={16} weight="regular" />
              </button>
              {menuId === journal._id && (
                <div className="absolute right-0 top-8 z-10 min-w-[160px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuId(null);
                      router.push(`/journal/${journal._id}?edit=1`);
                    }}
                    className="mb-1 w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenuId(null);
                      setPendingDeleteId(journal._id);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--danger)] hover:bg-[color:var(--surface)] whitespace-nowrap cursor-pointer"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
          <div className="mt-4 flex-1 overflow-hidden">
            <p className="text-sm font-semibold text-[color:var(--ink)] line-clamp-2">
              {journal.title}
            </p>
            <p className="mt-3 text-xs text-[color:var(--subtle)] leading-relaxed line-clamp-6 whitespace-pre-line">
              {journal.content}
            </p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[color:var(--ink)]">Journal</h1>
          <p className="text-sm text-[color:var(--subtle)]">
            Private entries visible only to you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            if (showCreate && isDirty) {
              setPendingAction(() => () => {
                setShowCreate(false);
                setIsDirty(false);
              });
              setShowDiscardConfirm(true);
              return;
            }
            setShowCreate(true);
          }}
          className="post-button inline-flex items-center gap-2"
        >
          <Plus size={16} weight="regular" />
          New journal
        </button>
      </div>

      {showCreate ? (
        <div ref={createRef} className="panel p-6 sm:p-8 rounded-none">
          <JournalForm
            submitLabel="Create"
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
      ) : journals.length === 0 ? (
        <EmptyState
          title="No journal entries yet."
          description="Start writing a private note or journal."
        />
      ) : (
        <div className="flex flex-col gap-8">
          {todayItems.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                Today
              </h2>
              <div className="mt-4">{renderGrid(todayItems)}</div>
            </div>
          )}
          {sortedGroups.map(([key, items]) => {
            const [year, month] = key.split("-").map(Number);
            const label = getMonthLabel(new Date(year, month, 1));
            return (
              <div key={key}>
                <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                  {label}
                </h2>
                <div className="mt-4">{renderGrid(items)}</div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title="Discard changes?"
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

      <Modal
        title="Delete journal?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your journal entry.
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
              if (pendingDeleteId) {
                await deleteMutation.mutateAsync(pendingDeleteId);
              }
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
          >
            Delete
          </button>
        </div>
      </Modal>
    </section>
  );
}
