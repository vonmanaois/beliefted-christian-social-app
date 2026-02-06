"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import PostForm from "@/components/prayer/PostForm";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import Modal from "@/components/layout/Modal";

export default function PrayerWall() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showComposer, setShowComposer] = useState(false);
  const { data: session } = useSession();

  useEffect(() => {
    const handleOpenPrayer = () => {
      setShowComposer(true);
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, []);

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
          Write your new prayer request ...
        </span>
      </button>
      <PrayerFeed refreshKey={refreshKey} />

      <Modal
        title="New Prayer"
        isOpen={showComposer}
        onClose={() => setShowComposer(false)}
      >
        <PostForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowComposer(false);
          }}
        />
      </Modal>
    </section>
  );
}
