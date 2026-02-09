"use client";

import { getDailyVerse } from "@/lib/dailyVerse";

export default function DailyVerseCard() {
  const verse = getDailyVerse();

  return (
    <div className="border-b border-[color:var(--panel-border)] px-4 py-4 sm:px-6">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--subtle)]">
        Daily Verse
      </p>
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
