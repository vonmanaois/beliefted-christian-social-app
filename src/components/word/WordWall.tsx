"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import WordForm from "@/components/word/WordForm";
import WordFeed from "@/components/word/WordFeed";
import Modal from "@/components/layout/Modal";

export default function WordWall() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const { data: session } = useSession();

  return (
    <section className="feed-surface">
      <button
        type="button"
        onClick={() => setShowComposer(true)}
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
          Share God's word today
        </span>
      </button>
      <WordFeed refreshKey={refreshKey} />

      <Modal
        title="Post a Word"
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
      >
        <WordForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowComposer(false);
          }}
        />
      </Modal>
    </section>
  );
}
