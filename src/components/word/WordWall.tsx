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
        return;
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
    window.addEventListener("open-word-composer-with-text", handleOpenWordWithText as EventListener);
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
      <div className="relative z-20 -mb-2 px-3 sm:px-4 pt-4 overflow-visible">
        <DayStoryStrip />
      </div>
      <section className={`feed-surface ${isMounted ? "feed-surface--enter" : "feed-surface--pre"}`}>
        <DailyVerseCard />
        <EventFeedPreview />
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
        <div className="px-3 sm:px-4 pt-2 pb-2 flex justify-end">
        <div
          className="inline-flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface)] p-1 shadow-sm"
          suppressHydrationWarning
        >
          <button
            type="button"
            onClick={() => setFeedMode("latest")}
            className={`min-w-[84px] rounded-full px-4 py-1.5 text-center text-[12px] font-semibold transition ${
              feedMode === "latest"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                : "text-[color:var(--subtle)] hover:text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
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
            className={`min-w-[84px] rounded-full px-4 py-1.5 text-center text-[12px] font-semibold transition ${
              feedMode === "forYou"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] shadow"
                : "text-[color:var(--subtle)] hover:text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
            }`}
          >
            For You
          </button>
        </div>
        </div>
        <div key={feedMode} className="transition-opacity duration-150">
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
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
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
            className="rounded-lg px-3 py-2 text-xs font-semibold bg-[color:var(--danger)] text-white cursor-pointer"
          >
            Discard
          </button>
        </div>
        </Modal>
      </section>
    </>
  );
}
