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
      <div className="border-b border-[color:var(--panel-border)] px-4 py-3 sm:px-6 text-xs text-[color:var(--subtle)]">
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
    <div className="border-b border-[color:var(--panel-border)] px-4 py-4 sm:px-6">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--subtle)]">
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
      <p className="mt-2 text-sm sm:text-base font-semibold text-[color:var(--ink)]">
        {verse.reference}
      </p>
      <p className="mt-2 text-[13px] sm:text-sm leading-relaxed text-[color:var(--subtle)] whitespace-pre-line">
        {verse.text}
      </p>
      {verse.prompt && (
        <p className="mt-3 text-xs font-semibold text-[color:var(--accent)]">
          {verse.prompt}
        </p>
      )}
    </div>
  );
}
