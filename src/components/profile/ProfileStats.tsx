"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "@/components/layout/Modal";
import Avatar from "@/components/ui/Avatar";

type ProfileStatsProps = {
  initialPrayedCount: number;
  initialFollowersCount: number;
  initialFollowingCount: number;
  usernameParam?: string | null;
};

type ProfilePayload = {
  followersCount?: number;
  followingCount?: number;
  prayersLiftedCount?: number;
};

type ConnectionUser = {
  id: string;
  name?: string | null;
  username?: string | null;
  image?: string | null;
};

export default function ProfileStats({
  initialPrayedCount,
  initialFollowersCount,
  initialFollowingCount,
  usernameParam,
}: ProfileStatsProps) {
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const queryClient = useQueryClient();

  const profileKey = useMemo(
    () => ["profile-stats", usernameParam ?? "me"],
    [usernameParam]
  );

  const { data: profile, isLoading } = useQuery({
    queryKey: profileKey,
    queryFn: async () => {
      const query = usernameParam ? `?username=${usernameParam}` : "";
      const response = await fetch(`/api/user/profile${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load profile stats");
      }
      return (await response.json()) as ProfilePayload;
    },
    initialData: {
      followersCount: initialFollowersCount,
      followingCount: initialFollowingCount,
      prayersLiftedCount: initialPrayedCount,
    },
    staleTime: 30000,
  });

  const connectionType = showFollowers ? "followers" : showFollowing ? "following" : null;
  const connectionsLabelText = showFollowers ? "Followers" : "Following";

  const {
    data: connections = [],
    isLoading: connectionsLoading,
  } = useQuery({
    queryKey: ["profile-connections", usernameParam ?? "me", connectionType],
    queryFn: async () => {
      if (!connectionType) return [];
      const params = new URLSearchParams({ type: connectionType });
      if (usernameParam) params.set("username", usernameParam);
      const response = await fetch(`/api/user/connections?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load connections");
      }
      return (await response.json()) as ConnectionUser[];
    },
    enabled: Boolean(connectionType),
  });

  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ followersCount?: number }>).detail;
      if (typeof detail?.followersCount === "number") {
        queryClient.setQueryData<ProfilePayload>(profileKey, (current) => ({
          ...(current ?? {}),
          followersCount: detail.followersCount,
        }));
      }
    };

    const refreshListener = () => {
      queryClient.invalidateQueries({ queryKey: profileKey });
    };

    window.addEventListener("follow:updated", listener);
    window.addEventListener("stats:refresh", refreshListener);

    return () => {
      window.removeEventListener("follow:updated", listener);
      window.removeEventListener("stats:refresh", refreshListener);
    };
  }, [profileKey, queryClient]);

  return (
    <div className="mt-6 flex flex-wrap gap-6 text-sm text-[color:var(--subtle)]">
      <div className="flex flex-col">
        <span>Reprayed</span>
        <span className="text-lg font-semibold text-[color:var(--ink)]">
          {profile?.prayersLiftedCount ?? 0}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setShowFollowers(true);
          setShowFollowing(false);
        }}
        className="flex flex-col text-left cursor-pointer hover:text-[color:var(--accent)]"
      >
        <span>Followers</span>
        {isLoading ? (
          <span className="mt-2 h-4 w-10 bg-slate-200 rounded-full animate-pulse" />
        ) : (
          <span className="text-lg font-semibold text-[color:var(--ink)]">
            {profile?.followersCount ?? 0}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setShowFollowing(true);
          setShowFollowers(false);
        }}
        className="flex flex-col text-left cursor-pointer hover:text-[color:var(--accent)]"
      >
        <span>Following</span>
        {isLoading ? (
          <span className="mt-2 h-4 w-10 bg-slate-200 rounded-full animate-pulse" />
        ) : (
          <span className="text-lg font-semibold text-[color:var(--ink)]">
            {profile?.followingCount ?? 0}
          </span>
        )}
      </button>

      <Modal
        title={connectionsLabelText}
        isOpen={showFollowers || showFollowing}
        onClose={() => {
          setShowFollowers(false);
          setShowFollowing(false);
        }}
      >
        {connectionsLoading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-slate-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 w-24 bg-slate-200 rounded-full animate-pulse" />
                  <div className="mt-2 h-3 w-16 bg-slate-200 rounded-full animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : connections.length === 0 ? (
          <p className="text-sm text-[color:var(--subtle)]">
            No {connectionsLabelText.toLowerCase()} yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {connections.map((user) => {
              const href = user.username ? `/profile/${user.username}` : "/profile";
              return (
                <a
                  key={user.id}
                  href={href}
                  className="flex items-center gap-3 cursor-pointer hover:text-[color:var(--accent)]"
                >
                  <Avatar
                    src={user.image ?? null}
                    alt={user.name ?? "User"}
                    size={36}
                    fallback={(user.name?.[0] ?? "U").toUpperCase()}
                    className="h-8 w-8 text-[11px]"
                  />
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {user.name ?? "User"}
                    </p>
                    {user.username && (
                      <p className="text-xs text-[color:var(--subtle)]">
                        @{user.username}
                      </p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </Modal>
    </div>
  );
}
