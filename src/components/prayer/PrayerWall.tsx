"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import Modal from "@/components/layout/Modal";
import { useUIStore } from "@/lib/uiStore";
import { UserCircle } from "@phosphor-icons/react";
import Spinner from "@/components/ui/Spinner";
import DailyVerseCard from "@/components/home/DailyVerseCard";

const PostForm = dynamic(() => import("@/components/prayer/PostForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

export default function PrayerWall() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [isPrayerDirty, setIsPrayerDirty] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();

  useEffect(() => {
    const handleOpenPrayer = () => {
      if (!isAuthenticated) {
        openSignIn();
        return;
      }
      setShowComposer(true);
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, [isAuthenticated, openSignIn]);

  return (
    <section className="feed-surface">
      <DailyVerseCard />
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
          <span className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={56}
                height={56}
                sizes="28px"
                className="h-full w-full object-cover"
              />
            ) : (
              <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
            )}
          </span>
          {isAuthenticated
            ? "Write a prayer"
            : "Sign in to post a prayer"}
        </span>
      </button>
      <PrayerFeed refreshKey={refreshKey} />

      <Modal
        title="New Prayer"
        isOpen={showComposer}
        onClose={() => {
          if (isPrayerDirty) {
            setShowDiscardConfirm(true);
            return;
          }
          setShowComposer(false);
        }}
      >
        <PostForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowComposer(false);
          }}
          onDirtyChange={setIsPrayerDirty}
        />
      </Modal>

      <Modal
        title="Discard prayer?"
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
