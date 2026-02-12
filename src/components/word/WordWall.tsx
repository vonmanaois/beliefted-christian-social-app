"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import WordFeed from "@/components/word/WordFeed";
import Modal from "@/components/layout/Modal";
import { useUIStore } from "@/lib/uiStore";
import { UserCircle } from "@phosphor-icons/react";
import Spinner from "@/components/ui/Spinner";
import DailyVerseCard from "@/components/home/DailyVerseCard";

const WordForm = dynamic(() => import("@/components/word/WordForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

export default function WordWall() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [formKey, setFormKey] = useState(0);
  const [isWordDirty, setIsWordDirty] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();

  useEffect(() => {
    const handleOpenWord = () => {
      if (!isAuthenticated) {
        openSignIn();
        return;
      }
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [isAuthenticated, openSignIn]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (formRef.current?.contains(target)) return;
      if (!isWordDirty || showDiscardConfirm) return;
      setShowDiscardConfirm(true);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isWordDirty, showDiscardConfirm]);

  return (
    <section className="feed-surface">
      <DailyVerseCard />
      <div ref={formRef} className="wall-card flex items-start gap-3 rounded-none border-b-0 pb-3">
        <div className="avatar-ring">
          {session?.user?.image ? (
            <Image
              src={session.user.image}
              alt="Profile"
              width={56}
              height={56}
              sizes="32px"
              className="avatar-core h-8 w-8 sm:h-10 sm:w-10 object-cover"
            />
          ) : (
            <div className="avatar-core h-8 w-8 sm:h-10 sm:w-10 flex items-center justify-center">
              <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <WordForm
            key={formKey}
            variant="inline"
            flat
            compact
            showHeader={false}
            placeholder="What does God want you to share today?"
            onPosted={() => {
              setRefreshKey((prev) => prev + 1);
              setFormKey((prev) => prev + 1);
              setIsWordDirty(false);
            }}
            onDirtyChange={setIsWordDirty}
          />
        </div>
      </div>
      <WordFeed refreshKey={refreshKey} />

      <Modal
        title="Discard post?"
        isOpen={showDiscardConfirm}
        onClose={() => setShowDiscardConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have an unfinished post. Discard it?
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
              setFormKey((prev) => prev + 1);
              setIsWordDirty(false);
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
