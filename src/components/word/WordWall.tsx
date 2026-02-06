"use client";

import { useState } from "react";
import WordForm from "@/components/word/WordForm";
import WordFeed from "@/components/word/WordFeed";

export default function WordWall() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="feed-surface">
      <WordForm flat onPosted={() => setRefreshKey((prev) => prev + 1)} />
      <WordFeed refreshKey={refreshKey} />
    </section>
  );
}
