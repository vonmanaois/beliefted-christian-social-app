"use client";

import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import FollowButton from "@/components/profile/FollowButton";
import ProfileHeader from "@/components/profile/ProfileHeader";
import ProfileUpdateModal from "@/components/profile/ProfileUpdateModal";
import ProfileStats from "@/components/profile/ProfileStats";
import ProfileTabs from "@/components/profile/ProfileTabs";
import ProfilePhotoUploader from "@/components/profile/ProfilePhotoUploader";
import UserIcon from "@/components/ui/UserIcon";
import EmptyState from "@/components/ui/EmptyState";
import { cloudinaryTransform } from "@/lib/cloudinary";

const profileQuery = async (username: string) => {
  const response = await fetch(`/api/user/profile?username=${encodeURIComponent(username)}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = typeof error?.error === "string" ? error.error : "Failed to load profile";
    throw new Error(message);
  }
  return response.json() as Promise<{
    userId: string;
    name: string | null;
    username: string | null;
    bio: string | null;
    image: string | null;
    followersCount: number;
    followingCount: number;
    prayersLiftedCount: number;
    isSelf?: boolean;
    isFollowing?: boolean;
  }>;
};

export default function ProfilePublicClient({ username }: { username: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["profile", username],
    queryFn: () => profileQuery(username),
  });

  if (isLoading) {
    return (
      <div className="px-4 pt-6 sm:px-0 sm:pt-0 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="h-6 w-40 rounded-lg bg-[color:var(--surface-strong)]" />
            <div className="h-4 w-28 rounded-lg bg-[color:var(--surface-strong)]" />
          </div>
          <div className="h-20 w-20 rounded-full bg-[color:var(--surface-strong)]" />
        </div>
        <div className="mt-4 h-10 w-full rounded-xl bg-[color:var(--surface-strong)]" />
        <div className="mt-4 h-20 w-full rounded-xl bg-[color:var(--surface-strong)]" />
        <div className="my-6 h-px w-full bg-[color:var(--panel-border)]" />
        <div className="space-y-3">
          <div className="h-6 w-48 rounded-lg bg-[color:var(--surface-strong)]" />
          <div className="h-6 w-40 rounded-lg bg-[color:var(--surface-strong)]" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="px-4 pt-6 sm:px-0 sm:pt-0">
        <EmptyState
          title="Profile not available"
          description={
            error instanceof Error
              ? error.message
              : "This profile could not be loaded."
          }
        />
      </div>
    );
  }

  const isSelf = Boolean(data.isSelf);
  const isFollowing = Boolean(data.isFollowing);

  return (
    <div className="px-4 pt-6 sm:px-0 sm:pt-0">
      <div className="flex items-center justify-between gap-4">
        <ProfileHeader
          initialName={data.name ?? "User"}
          initialUsername={data.username ?? username}
          initialBio={data.bio ?? null}
          usernameParam={data.username ?? null}
        />
        {isSelf ? (
          <ProfilePhotoUploader
            currentImage={data.image ?? null}
            currentName={data.name ?? ""}
            currentUsername={data.username ?? ""}
            currentBio={data.bio ?? ""}
            size={80}
          />
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-full overflow-hidden border border-slate-200 bg-slate-200">
            {data.image ? (
              <Image
                src={cloudinaryTransform(data.image, { width: 160, height: 160 })}
                alt="Profile"
                width={160}
                height={160}
                sizes="80px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-[color:var(--subtle)]">
                <UserIcon size={44} />
              </div>
            )}
          </div>
        )}
      </div>

      {!isSelf && (
        <div className="mt-4 w-full">
          <FollowButton targetUserId={data.userId} initialFollowing={isFollowing} />
        </div>
      )}

      {isSelf && (
        <div className="mt-4">
          <ProfileUpdateModal
            currentUsername={data.username ?? null}
            currentName={data.name ?? null}
            currentBio={data.bio ?? null}
          />
        </div>
      )}

      <ProfileStats
        initialPrayedCount={data.prayersLiftedCount}
        initialFollowersCount={data.followersCount}
        initialFollowingCount={data.followingCount}
        usernameParam={data.username ?? null}
      />

      <div className="my-6 border-t border-[color:var(--panel-border)]" />

      <ProfileTabs
        userId={data.userId}
        showComposer={isSelf}
        initialTab="Word"
      />
    </div>
  );
}
