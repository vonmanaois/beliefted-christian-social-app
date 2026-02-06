"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

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

  const handleFollow = async () => {
    if (!session?.user?.id) {
      signIn("google");
      return;
    }

    setIsUpdating(true);

    try {
      const response = await fetch("/api/user/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });

      if (!response.ok) {
        throw new Error("Failed to update follow status");
      }

      const data = (await response.json()) as {
        following: boolean;
        followersCount?: number;
      };
      setIsFollowing(data.following);
      if (typeof data.followersCount === "number") {
        window.dispatchEvent(
          new CustomEvent("follow:updated", {
            detail: { followersCount: data.followersCount },
          })
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleFollow}
      disabled={isUpdating}
      className={`pill-button border text-sm cursor-pointer ${
        isFollowing
          ? "border-slate-200 text-[color:var(--ink)]"
          : "border-transparent bg-[color:var(--accent)] text-white"
      }`}
    >
      {isFollowing ? "Following" : "Follow"}
    </button>
  );
}
