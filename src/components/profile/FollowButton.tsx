"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

type FollowButtonProps = {
  targetUserId: string;
  initialFollowing: boolean;
};

export default function FollowButton({
  targetUserId,
  initialFollowing,
}: FollowButtonProps) {
  const { data: session } = useSession();
  const [isFollowing, setIsFollowing] = useState(initialFollowing);
  const [isUpdating, setIsUpdating] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);

  const handleFollow = async () => {
    if (!session?.user?.id) {
      return;
    }

    const previousFollowing = isFollowing;
    setIsUpdating(true);
    setIsFollowing((prev) => !prev);
    setFollowError(null);

    try {
      const response = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });

      const data = (await response.json().catch(() => null)) as {
        following: boolean;
        followersCount?: number;
        error?: string;
      } | null;

      if (!response.ok) {
        console.error(
          "Failed to update follow status",
          response.status,
          data?.error
        );
        setIsFollowing(previousFollowing);
        setFollowError("Couldn't update follow.");
        return;
      }

      if (!data) return;
      setIsFollowing(data.following);
      if (typeof data.followersCount === "number") {
        window.dispatchEvent(
          new CustomEvent("follow:updated", {
            detail: { followersCount: data.followersCount },
          })
        );
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("notifications:refresh"));
      }
    } catch (error) {
      console.error(error);
      setIsFollowing(previousFollowing);
      setFollowError("Couldn't update follow.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (!session?.user?.id) return null;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleFollow}
        disabled={isUpdating}
        className={`post-button w-full sm:w-auto cursor-pointer ${
          isFollowing
            ? "bg-transparent border border-[color:var(--panel-border)] text-[color:var(--ink)]"
            : "bg-[color:var(--accent)] text-[color:var(--accent-contrast)]"
        }`}
      >
        {isFollowing ? "Following" : "Follow"}
      </button>
      {followError && (
        <div className="text-[11px] text-[color:var(--subtle)] flex items-center gap-2">
          <span>{followError}</span>
          <button
            type="button"
            onClick={handleFollow}
            className="text-[color:var(--accent)] hover:text-[color:var(--accent-strong)] text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
