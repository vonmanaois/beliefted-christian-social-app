"use client";

import { useState } from "react";
import PostForm from "@/components/prayer/PostForm";
import PrayerFeed from "@/components/prayer/PrayerFeed";

export default function PrayerWall() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <section className="feed-surface">
      <PostForm flat onPosted={() => setRefreshKey((prev) => prev + 1)} />
      <PrayerFeed refreshKey={refreshKey} />
    </section>
  );
}
