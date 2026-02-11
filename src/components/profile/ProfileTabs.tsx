"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import PrayerFeed from "@/components/prayer/PrayerFeed";
import WordFeed from "@/components/word/WordFeed";
import Modal from "@/components/layout/Modal";
import { UserCircle } from "@phosphor-icons/react";
import { cloudinaryTransform } from "@/lib/cloudinary";
import Spinner from "@/components/ui/Spinner";

const tabs = ["Faith Share", "Prayers", "Reprayed", "Saved"] as const;

const PostForm = dynamic(() => import("@/components/prayer/PostForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

const WordForm = dynamic(() => import("@/components/word/WordForm"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 text-xs text-[color:var(--subtle)]">
      <Spinner size={14} />
      Loading...
    </div>
  ),
});

type Tab = (typeof tabs)[number];

type ProfileTabsProps = {
  userId: string;
  showComposer?: boolean;
  initialTab?: Tab;
  basePath?: string;
};

export default function ProfileTabs({
  userId,
  showComposer = true,
  initialTab = "Faith Share",
  basePath,
}: ProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);
  const router = useRouter();
  const pathname = usePathname();
  const [refreshKey, setRefreshKey] = useState(0);
  const [showPrayerComposer, setShowPrayerComposer] = useState(false);
  const [showWordComposer, setShowWordComposer] = useState(false);
  const [showPrayerDiscardConfirm, setShowPrayerDiscardConfirm] = useState(false);
  const [isPrayerDirty, setIsPrayerDirty] = useState(false);
  const [showWordDiscardConfirm, setShowWordDiscardConfirm] = useState(false);
  const [isWordDirty, setIsWordDirty] = useState(false);
  const { data: session } = useSession();
  const isSelf = Boolean(session?.user?.id && session.user.id === userId);
  const visibleTabs = tabs.filter((tab) => (tab === "Saved" ? isSelf : true));

  useEffect(() => {
    if (visibleTabs.includes(activeTab)) return;
    setActiveTab(visibleTabs[0] ?? "Faith Share");
  }, [activeTab, visibleTabs]);

  useEffect(() => {
    const handleOpenPrayer = () => {
      setActiveTab("Prayers");
      if (basePath) {
        router.push(`${basePath}/prayers`);
      }
      setShowPrayerComposer(true);
    };
    window.addEventListener("open-prayer-composer", handleOpenPrayer);
    return () => window.removeEventListener("open-prayer-composer", handleOpenPrayer);
  }, [basePath, router]);

  useEffect(() => {
    const handleOpenWord = () => {
      setActiveTab("Faith Share");
      if (basePath) {
        router.push(basePath);
      }
      setShowWordComposer(true);
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [basePath, router]);

  return (
    <section className="mt-6 flex flex-col gap-6">
      <div className="w-full px-4 sm:px-0">
        <div
          className="grid w-full rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-1"
          style={{ gridTemplateColumns: `repeat(${visibleTabs.length}, minmax(0, 1fr))` }}
        >
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                if (!basePath) return;
                if (tab === "Faith Share" && pathname === basePath) {
                  return;
                }
                if (tab === "Prayers") {
                  router.push(`${basePath}/prayers`);
                  return;
                }
                if (tab === "Reprayed") {
                  router.push(`${basePath}/reprayed`);
                  return;
                }
                if (tab === "Saved") {
                  router.push(`${basePath}/saved`);
                  return;
                }
                router.push(basePath);
              }}
              className={`w-full rounded-lg px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
                  : "text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="feed-surface">
        {activeTab === "Faith Share" ? (
          <>
            {showComposer && (
              <button
                type="button"
                onClick={() => setShowWordComposer(true)}
                className="composer-trigger cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
                    {session?.user?.image ? (
                      <Image
                        src={cloudinaryTransform(session.user.image, { width: 64, height: 64 })}
                        alt=""
                        width={64}
                        height={64}
                        sizes="28px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
                    )}
                  </span>
                  Share your faith
                </span>
              </button>
            )}
            <WordFeed refreshKey={refreshKey} userId={userId} />
          </>
        ) : activeTab === "Prayers" ? (
          <>
            {showComposer && (
              <button
                type="button"
                onClick={() => setShowPrayerComposer(true)}
                className="composer-trigger cursor-pointer"
              >
                <span className="inline-flex items-center gap-2">
                  <span className="h-7 w-7 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
                    {session?.user?.image ? (
                      <Image
                        src={cloudinaryTransform(session.user.image, { width: 64, height: 64 })}
                        alt=""
                        width={64}
                        height={64}
                        sizes="28px"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <UserCircle size={20} weight="regular" className="text-[color:var(--subtle)]" />
                    )}
                  </span>
                  Write your new prayer request ...
                </span>
              </button>
            )}
            <PrayerFeed refreshKey={refreshKey} userId={userId} />
          </>
        ) : activeTab === "Reprayed" ? (
          <PrayerFeed refreshKey={refreshKey} userId={userId} reprayedOnly />
        ) : (
          <WordFeed refreshKey={refreshKey} userId={userId} savedOnly />
        )}
      </div>

      <Modal
        title="New Prayer"
        isOpen={showPrayerComposer}
        onClose={() => {
          if (isPrayerDirty) {
            setShowPrayerDiscardConfirm(true);
            return;
          }
          setShowPrayerComposer(false);
        }}
      >
        <PostForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowPrayerComposer(false);
          }}
          onDirtyChange={setIsPrayerDirty}
        />
      </Modal>

      <Modal
        title="Discard prayer?"
        isOpen={showPrayerDiscardConfirm}
        onClose={() => setShowPrayerDiscardConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved changes. Discard them?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowPrayerDiscardConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setShowPrayerDiscardConfirm(false);
              setShowPrayerComposer(false);
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--danger)] text-white cursor-pointer"
          >
            Discard
          </button>
        </div>
      </Modal>

      <Modal
        title="Post a Word"
        isOpen={showWordComposer}
        onClose={() => {
          if (isWordDirty) {
            setShowWordDiscardConfirm(true);
            return;
          }
          setShowWordComposer(false);
        }}
      >
        <WordForm
          onPosted={() => {
            setRefreshKey((prev) => prev + 1);
            setShowWordComposer(false);
          }}
          onDirtyChange={setIsWordDirty}
        />
      </Modal>

      <Modal
        title="Discard word?"
        isOpen={showWordDiscardConfirm}
        onClose={() => setShowWordDiscardConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          You have unsaved changes. Discard them?
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowWordDiscardConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
          >
            Keep editing
          </button>
          <button
            type="button"
            onClick={() => {
              setShowWordDiscardConfirm(false);
              setShowWordComposer(false);
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
