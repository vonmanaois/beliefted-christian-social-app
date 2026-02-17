"use client";

type FeedSkeletonProps = {
  count?: number;
};

export default function FeedSkeleton({ count = 3 }: FeedSkeletonProps) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="wall-card">
          <div className="flex gap-4">
            <div className="h-12 w-12 rounded-full bg-[color:var(--surface-strong)] animate-pulse" />
            <div className="flex-1">
              <div className="h-3 w-32 bg-[color:var(--surface-strong)] rounded-full animate-pulse" />
              <div className="mt-2 h-3 w-24 bg-[color:var(--surface-strong)] rounded-full animate-pulse" />
              <div className="mt-4 h-3 w-full bg-[color:var(--surface-strong)] rounded-full animate-pulse" />
              <div className="mt-2 h-3 w-5/6 bg-[color:var(--surface-strong)] rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
