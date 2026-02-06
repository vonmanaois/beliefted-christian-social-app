"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [words, setWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadWords = useCallback(async () => {
    setIsLoading(true);

    try {
      const query = userId ? `?userId=${userId}` : "";
      const response = await fetch(`/api/words${query}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load words");
      }

      const data = (await response.json()) as Word[];
      setWords(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadWords();
  }, [loadWords, refreshKey]);

  if (isLoading) {
    return (
      <div className="panel p-5 text-sm text-[color:var(--subtle)]">
        Loading words...
      </div>
    );
  }

  if (words.length === 0) {
    return (
      <div className="panel p-5 text-sm text-[color:var(--subtle)]">
        No words yet.
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
