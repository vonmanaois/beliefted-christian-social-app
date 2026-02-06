"use client";

import { useQuery } from "@tanstack/react-query";
import PrayerCard, { type Prayer } from "@/components/prayer/PrayerCard";

type PrayerFeedProps = {
  refreshKey: number;
  userId?: string;
};

export default function PrayerFeed({ refreshKey, userId }: PrayerFeedProps) {
  const { data: prayers = [], isLoading } = useQuery({
    queryKey: ["prayers", userId, refreshKey],
    queryFn: async () => {
      const query = userId ? `?userId=${userId}` : "";
      const response = await fetch(`/api/prayers${query}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load prayers");
      }
      const data = (await response.json()) as Prayer[];
      return data.map((prayer) => ({
        ...prayer,
        _id:
          typeof prayer._id === "string"
            ? prayer._id
            : String((prayer._id as { $oid?: string })?.$oid ?? prayer._id),
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

  if (prayers.length === 0) {
    return (
      <div className="panel p-6 text-sm text-[color:var(--subtle)]">
        <p className="text-[color:var(--ink)] font-semibold">
          No prayers yet.
        </p>
        <p className="mt-1">Be the first to share something uplifting.</p>
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
