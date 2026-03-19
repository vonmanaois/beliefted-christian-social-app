"use client";

import { useSyncExternalStore } from "react";
import { X } from "@phosphor-icons/react";
import { getDailyVerse } from "@/lib/dailyVerse";

export default function DailyVerseCard() {
  const verse = getDailyVerse();
  const isDismissed = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => callback();
      window.addEventListener("storage", handler);
      window.addEventListener("beliefted:daily-verse", handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("beliefted:daily-verse", handler);
      };
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem("dailyVerseDismissed") === "true";
    },
    () => false
  );

  if (isDismissed) {
    return (
      <div className="px-4 py-2 sm:px-6 text-xs text-[color:var(--subtle)]">
        Daily verse hidden.
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem("dailyVerseDismissed");
            window.dispatchEvent(new Event("beliefted:daily-verse"));
          }}
          className="ml-2 font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent)]"
        >
          Show again
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-[24px] border border-[color:var(--panel-border)]/70 bg-[color:var(--surface)]/56 px-4 py-4 shadow-[0_12px_28px_rgba(0,0,0,0.08)] sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <p className="section-eyebrow">
          Daily Verse
        </p>
        <button
          type="button"
          onClick={() => {
            if (typeof window !== "undefined") {
              window.localStorage.setItem("dailyVerseDismissed", "true");
              window.dispatchEvent(new Event("beliefted:daily-verse"));
            }
          }}
          className="h-7 w-7 rounded-full text-[color:var(--subtle)] hover:text-[color:var(--accent)]"
          aria-label="Dismiss daily verse"
        >
          <X size={16} />
        </button>
      </div>
      <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">
        {verse.reference}
      </p>
      <p className="meta-copy mt-2 whitespace-pre-line sm:text-sm">
        {verse.text}
      </p>
      {verse.prompt && (
        <p className="mt-3 text-xs font-semibold text-[color:var(--accent)]">
          {verse.prompt}
        </p>
      )}
      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.dispatchEvent(
              new CustomEvent("open-word-composer-with-text", {
                detail: { verse: { reference: verse.reference, text: verse.text } },
              })
            );
          }}
          className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        >
          Post about this verse
        </button>
      </div>
    </div>
  );
}
