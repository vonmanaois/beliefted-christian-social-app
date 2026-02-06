"use client";

import { useCallback, useEffect, useState } from "react";
import PrayerCard, { type Prayer } from "@/components/prayer/PrayerCard";

type PrayerFeedProps = {
  refreshKey: number;
  userId?: string;
};

export default function PrayerFeed({ refreshKey, userId }: PrayerFeedProps) {
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadPrayers = useCallback(async () => {
    setIsLoading(true);

    try {
      const query = userId ? `?userId=${userId}` : "";
      const response = await fetch(`/api/prayers${query}`, { cache: "no-store" });

      if (!response.ok) {
        throw new Error("Failed to load prayers");
      }

      const data = (await response.json()) as Prayer[];
      setPrayers(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPrayers();
  }, [loadPrayers, refreshKey]);

  if (isLoading) {
    return (
      <div className="panel p-5 text-sm text-slate-500">
        Loading prayers...
      </div>
    );
  }

  if (prayers.length === 0) {
    return (
      <div className="panel p-5 text-sm text-slate-500">
        No prayers yet. Be the first to share.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {prayers.map((prayer) => (
        <PrayerCard key={prayer._id} prayer={prayer} />
      ))}
    </div>
  );
}
