"use client";

import { useQuery } from "@tanstack/react-query";
import WordCard from "@/components/word/WordCard";

type Word = {
  _id: string;
  content: string;
  createdAt: string;
  user?: { name?: string | null; username?: string | null } | null;
};

type WordFeedProps = {
  refreshKey: number;
  userId?: string;
};

export default function WordFeed({ refreshKey, userId }: WordFeedProps) {
  const { data: words = [], isLoading } = useQuery({
    queryKey: ["words", userId, refreshKey],
    queryFn: async () => {
      const query = userId ? `?userId=${userId}` : "";
      const response = await fetch(`/api/words${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load words");
      }
      const data = (await response.json()) as Word[];
      return data.map((word) => ({
        ...word,
        _id:
          typeof word._id === "string"
            ? word._id
            : String((word._id as { $oid?: string })?.$oid ?? word._id),
      }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="wall-card">
            <div className="flex gap-4">
              <div className="h-12 w-12 rounded-full bg-slate-200 animate-pulse" />
              <div className="flex-1">
                <div className="h-3 w-32 bg-slate-200 rounded-full animate-pulse" />
                <div className="mt-2 h-3 w-24 bg-slate-200 rounded-full animate-pulse" />
                <div className="mt-4 h-3 w-full bg-slate-200 rounded-full animate-pulse" />
                <div className="mt-2 h-3 w-5/6 bg-slate-200 rounded-full animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="panel p-6 text-sm text-[color:var(--subtle)]">
        <p className="text-[color:var(--ink)] font-semibold">
          No words yet.
        </p>
        <p className="mt-1">Share a verse or encouragement to start.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {words.map((word) => (
        <WordCard key={word._id} word={word} />
      ))}
    </div>
  );
}
