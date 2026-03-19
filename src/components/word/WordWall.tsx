"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { UserCircle } from "@phosphor-icons/react";
import WordFeed from "@/components/word/WordFeed";
import Modal from "@/components/layout/Modal";
import { useUIStore } from "@/lib/uiStore";
import Spinner from "@/components/ui/Spinner";
import DailyVerseCard from "@/components/home/DailyVerseCard";
import EventFeedPreview from "@/components/events/EventFeedPreview";
import DayStoryStrip from "@/components/day/DayStoryStrip";

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
  const [pendingPrefillVerse, setPendingPrefillVerse] = useState<{
    reference: string;
    text: string;
  } | null>(null);
  const [activePrefillVerse, setActivePrefillVerse] = useState<{
    reference: string;
    text: string;
  } | null>(null);
  const [pendingPrefillText, setPendingPrefillText] = useState<string | null>(null);
  const [activePrefillText, setActivePrefillText] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [feedMode, setFeedMode] = useState<"latest" | "forYou">(() => {
    if (typeof window === "undefined") return "latest";
    const saved = window.localStorage.getItem("wordFeedMode");
    return saved === "forYou" ? "forYou" : "latest";
  });
  const [forYouCycle, setForYouCycle] = useState(0);
  const formRef = useRef<HTMLDivElement | null>(null);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const { openSignIn } = useUIStore();

  useEffect(() => {
    const handleOpenWord = () => {
      if (!isAuthenticated) {
        openSignIn();
      }
    };
    window.addEventListener("open-word-composer", handleOpenWord);
    return () => window.removeEventListener("open-word-composer", handleOpenWord);
  }, [isAuthenticated, openSignIn]);

  useEffect(() => {
    const handleOpenWordWithText = (event: Event) => {
      if (!isAuthenticated) {
        openSignIn();
        return;
      }
      const detail = (event as CustomEvent<{
        verse?: { reference?: string; text?: string };
        text?: string;
      }>).detail;
      const verse = detail?.verse;
      const text = detail?.text?.trim();
      if (!verse?.reference || !verse?.text) {
        if (!text) return;
      }
      if (isWordDirty) {
        if (verse?.reference && verse?.text) {
          setPendingPrefillVerse({ reference: verse.reference, text: verse.text });
        }
        if (text) {
          setPendingPrefillText(text);
        }
        setShowDiscardConfirm(true);
        return;
      }
      if (verse?.reference && verse?.text) {
        setActivePrefillVerse({ reference: verse.reference, text: verse.text });
        setActivePrefillText(null);
      } else if (text) {
        setActivePrefillText(text);
        setActivePrefillVerse(null);
      }
      setFormKey((prev) => prev + 1);
    };
    window.addEventListener(
      "open-word-composer-with-text",
      handleOpenWordWithText as EventListener
    );
    return () =>
      window.removeEventListener(
        "open-word-composer-with-text",
        handleOpenWordWithText as EventListener
      );
  }, [isAuthenticated, isWordDirty, openSignIn]);

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

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setIsMounted(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("wordFeedMode", feedMode);
  }, [feedMode]);

  return (
    <>
      <div className="relative z-20 px-3 sm:px-4 pt-4 overflow-visible">
        <DayStoryStrip />
      </div>

      <section
        className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}
      >
        <div className="feed-block">
          <DailyVerseCard />
        </div>

        <div className="feed-block">
          <EventFeedPreview />
        </div>

        <div className="feed-block">
          <div ref={formRef} className="composer-shell px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex items-start gap-3">
              <div className="avatar-ring mt-1">
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
                  <div className="avatar-core flex h-8 w-8 items-center justify-center sm:h-10 sm:w-10">
                    <UserCircle
                      size={20}
                      weight="regular"
                      className="text-[color:var(--subtle)]"
                    />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <WordForm
                  key={formKey}
                  variant="inline"
                  flat
                  compact
                  showHeader={false}
                  placeholder="What does God want you to share today?"
                  prefillVerse={activePrefillVerse ?? undefined}
                  initialContent={activePrefillText ?? undefined}
                  onPosted={() => {
                    setRefreshKey((prev) => prev + 1);
                    setFormKey((prev) => prev + 1);
                    setIsWordDirty(false);
                    setPendingPrefillVerse(null);
                    setActivePrefillVerse(null);
                    setPendingPrefillText(null);
                    setActivePrefillText(null);
                  }}
                  onDirtyChange={setIsWordDirty}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="feed-tabs-shell">
          <div
            className="inline-flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface)] p-1 shadow-sm"
            suppressHydrationWarning
          >
            <button
              type="button"
              onClick={() => setFeedMode("latest")}
              className={`segmented-tab-button relative z-10 inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-center text-[12px] font-semibold leading-none ${
                feedMode === "latest"
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                  : "text-[color:var(--subtle)] hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--ink)]"
              }`}
            >
              Latest
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedMode("forYou");
                setForYouCycle((prev) => prev + 1);
              }}
              className={`segmented-tab-button relative z-10 inline-flex min-w-[96px] items-center justify-center whitespace-nowrap rounded-full px-4 py-2 text-center text-[12px] font-semibold leading-none ${
                feedMode === "forYou"
                  ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                  : "text-[color:var(--subtle)] hover:bg-[color:var(--surface-strong)] hover:text-[color:var(--ink)]"
              }`}
            >
              For You
            </button>
          </div>
        </div>

        <div key={feedMode} className="tab-pane-soft-enter">
          <WordFeed refreshKey={refreshKey} mode={feedMode} forYouSeed={forYouCycle} />
        </div>

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
              onClick={() => {
                setShowDiscardConfirm(false);
                setPendingPrefillVerse(null);
                setPendingPrefillText(null);
              }}
              className="cursor-pointer rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            >
              Keep editing
            </button>
            <button
              type="button"
              onClick={() => {
                const nextPrefillVerse = pendingPrefillVerse;
                const nextPrefillText = pendingPrefillText;
                setShowDiscardConfirm(false);
                setFormKey((prev) => prev + 1);
                setIsWordDirty(false);
                setPendingPrefillVerse(null);
                setPendingPrefillText(null);
                if (nextPrefillVerse) {
                  setActivePrefillVerse(nextPrefillVerse);
                  setActivePrefillText(null);
                } else if (nextPrefillText) {
                  setActivePrefillText(nextPrefillText);
                  setActivePrefillVerse(null);
                }
              }}
              className="cursor-pointer rounded-lg bg-[color:var(--danger)] px-3 py-2 text-xs font-semibold text-white"
            >
              Discard
            </button>
          </div>
        </Modal>
      </section>
    </>
  );
}
