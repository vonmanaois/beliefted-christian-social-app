"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { DotsThreeOutline } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Modal from "@/components/layout/Modal";
import PostBackHeader from "@/components/ui/PostBackHeader";
import Spinner from "@/components/ui/Spinner";

type JournalDetailProps = {
  journal: {
    _id: string;
    title: string;
    content: string;
    createdAt: string;
  };
};

const JournalForm = dynamic(() => import("@/components/journal/JournalForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

const formatFullDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

export default function JournalDetail({ journal }: JournalDetailProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "1");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [pendingAction, setPendingAction] = useState<null | (() => void)>(null);
  const editRef = useRef<HTMLDivElement | null>(null);

  const updateMutation = useMutation({
    mutationFn: async ({ title, content }: { title: string; content: string }) => {
      const response = await fetch(`/api/journals/${journal._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      if (!response.ok) {
        throw new Error("Failed to update journal");
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
      const response = await fetch(`/api/journals/${journal._id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete journal");
      }
    },
    onSuccess: () => {
      router.back();
    },
  });
  const isDeleting = deleteMutation.isPending;

  useEffect(() => {
    if (!showMenu) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-journal-detail-menu]")) return;
      setShowMenu(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  useEffect(() => {
    if (!isEditing) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (editRef.current?.contains(target)) return;
      if (showDiscardConfirm) return;

      if (isDirty) {
        setPendingAction(() => () => {
          setIsEditing(false);
          setIsDirty(false);
        });
        setShowDiscardConfirm(true);
      } else {
        setIsEditing(false);
        setIsDirty(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isEditing, isDirty, showDiscardConfirm]);

  return (
    <div>
      <PostBackHeader label="Journal" />
      <div className="panel p-6 sm:p-8 rounded-none">
        {!isEditing ? (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between text-xs text-[color:var(--subtle)]">
              <span>{formatFullDate(journal.createdAt)}</span>
              <div className="relative" data-journal-detail-menu>
                <button
                  type="button"
                  onClick={() => setShowMenu((prev) => !prev)}
                  className="h-8 w-8 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--ink)] cursor-pointer"
                  aria-label="Journal actions"
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
            </div>
            <h1 className="text-xl font-semibold text-[color:var(--ink)]">
              {journal.title}
            </h1>
            <div className="text-sm text-[color:var(--ink)] whitespace-pre-wrap">
              {journal.content}
            </div>
          </div>
        ) : (
          <div ref={editRef}>
            <JournalForm
              initialTitle={journal.title}
              initialContent={journal.content}
              submitLabel="Save"
              onSubmit={async (title, content) => {
                await updateMutation.mutateAsync({ title, content });
                setIsDirty(false);
              }}
              onCancel={() => {
                if (isDirty) {
                  setPendingAction(() => () => {
                    setIsEditing(false);
                    setIsDirty(false);
                  });
                  setShowDiscardConfirm(true);
                  return;
                }
                setIsEditing(false);
                setIsDirty(false);
              }}
              onDirtyChange={setIsDirty}
            />
          </div>
        )}
      </div>

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
    </div>
  );
}
