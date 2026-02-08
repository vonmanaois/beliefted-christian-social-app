"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import WordForm from "@/components/word/WordForm";
import WordFeed from "@/components/word/WordFeed";
import Modal from "@/components/layout/Modal";
import { useUIStore } from "@/lib/uiStore";

export default function WordWall() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isWordDirty, setIsWordDirty] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();

  useEffect(() => {
    const handleOpenWord = () => {
      if (!isAuthenticated) {
        openSignIn();
        return;
      }
      setShowComposer(true);
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [isAuthenticated, openSignIn]);

  return (
    <section className="feed-surface">
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            openSignIn();
            return;
          }
          setShowComposer(true);
        }}
        className="composer-trigger cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <span className="h-7 w-7 rounded-full bg-slate-200 overflow-hidden flex items-center justify-center text-[10px] font-semibold text-slate-600">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              (session?.user?.name?.[0] ?? "U").toUpperCase()
            )}
          </span>
          {isAuthenticated ? "Share your faith" : "Sign in to post a word"}
        </span>
      </button>
      <WordFeed refreshKey={refreshKey} />

      <Modal
        title="Post a Word"
        isOpen={showComposer}
        onClose={() => {
          if (isWordDirty) {
            setShowDiscardConfirm(true);
            return;
          }
          setShowComposer(false);
        }}
      >
        <WordForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowComposer(false);
          }}
          onDirtyChange={setIsWordDirty}
        />
      </Modal>

      <Modal
        title="Discard word?"
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved changes. Discard them?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDiscardConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setShowDiscardConfirm(false);
              setShowComposer(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--danger)] text-white cursor-pointer"
          >
            Discard
          </button>
        </div>
      </Modal>

    </section>
  );
}
