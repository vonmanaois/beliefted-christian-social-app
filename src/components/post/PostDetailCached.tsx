"use client";

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PostBackHeader from "@/components/ui/PostBackHeader";
import PrayerCard from "@/components/prayer/PrayerCard";
import WordCard from "@/components/word/WordCard";
import type { Prayer } from "@/components/prayer/types";
import type { Word } from "@/components/word/types";

type CachedPost =
  | { type: "word"; word: Word }
  | { type: "prayer"; prayer: Prayer };

type PostDetailCachedProps = {
  postId: string;
};

const toId = (value: string | { $oid?: string } | undefined) =>
  typeof value === "string" ? value : value?.$oid ?? "";

const findInInfinite = <T extends { _id: string | { $oid?: string } }>(
  data: unknown,
  id: string
) => {
  if (!data || typeof data !== "object") return null;
  const pages = (data as { pages?: Array<{ items?: T[] }> }).pages ?? [];
  for (const page of pages) {
    const items = page.items ?? [];
    for (const item of items) {
      if (toId(item._id) === id) return item;
    }
  }
  return null;
};

const findCachedPost = (queryClient: ReturnType<typeof useQueryClient>, id: string): CachedPost | null => {
  const wordQueries = queryClient.getQueriesData({ queryKey: ["words"] });
  for (const [, data] of wordQueries) {
    const word = findInInfinite<Word>(data, id);
    if (word) return { type: "word", word };
  }

  const prayerQueries = queryClient.getQueriesData({ queryKey: ["prayers"] });
  for (const [, data] of prayerQueries) {
    const prayer = findInInfinite<Prayer>(data, id);
    if (prayer) return { type: "prayer", prayer };
  }

  const followingQueries = queryClient.getQueriesData({ queryKey: ["following-feed"] });
  for (const [, data] of followingQueries) {
    if (!data || typeof data !== "object") continue;
    const pages = (data as { pages?: Array<{ items?: CachedPost[] }> }).pages ?? [];
    for (const page of pages) {
      const items = page.items ?? [];
      for (const item of items) {
        if (item.type === "word" && toId(item.word._id) === id) return item;
        if (item.type === "prayer" && toId(item.prayer._id) === id) return item;
      }
    }
  }

  return null;
};

const fetchPost = async (postId: string): Promise<CachedPost> => {
  const wordResponse = await fetch(`/api/words/${postId}`, { cache: "no-store" });
  if (wordResponse.ok) {
    const word = (await wordResponse.json()) as Word;
    return { type: "word", word };
  }
  const prayerResponse = await fetch(`/api/prayers/${postId}`, { cache: "no-store" });
  if (prayerResponse.ok) {
    const prayer = (await prayerResponse.json()) as Prayer;
    return { type: "prayer", prayer };
  }
  throw new Error("Post not available");
};

export default function PostDetailCached({ postId }: PostDetailCachedProps) {
  const queryClient = useQueryClient();
  const cached = useMemo(() => findCachedPost(queryClient, postId), [queryClient, postId]);
  const fromCache = Boolean(cached);

  const { data, isLoading } = useQuery({
    queryKey: ["post-detail", postId],
    queryFn: () => fetchPost(postId),
    enabled: !cached,
    staleTime: 30000,
    retry: 1,
  });

  const resolved = cached ?? data;

  if (!resolved) {
    return (
      <div className={fromCache ? "cache-fade-in" : undefined}>
        <PostBackHeader label="Post" />
        <div className="panel p-6 text-sm text-[color:var(--subtle)]">
          {isLoading ? "Loading post..." : "This post is not available anymore."}
        </div>
      </div>
    );
  }

  if (resolved.type === "word") {
    return (
      <div className={fromCache ? "cache-fade-in" : undefined}>
        <PostBackHeader label="Word" />
        <div className="feed-surface sm:rounded-none sm:overflow-visible">
          <WordCard word={resolved.word} defaultShowComments alignContent={false} />
        </div>
      </div>
    );
  }

  return (
    <div className={fromCache ? "cache-fade-in" : undefined}>
      <PostBackHeader label="Prayer" />
      <div className="feed-surface sm:rounded-none sm:overflow-visible">
        <PrayerCard prayer={resolved.prayer} defaultShowComments alignContent={false} />
      </div>
    </div>
  );
}
