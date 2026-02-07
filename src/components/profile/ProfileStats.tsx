"use client";

import { useEffect, useState } from "react";
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
  const [followersCount, setFollowersCount] = useState(initialFollowersCount);
  const [followingCount, setFollowingCount] = useState(initialFollowingCount);
  const [prayersLiftedCount, setPrayersLiftedCount] = useState(initialPrayedCount);
  const [isLoading, setIsLoading] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);
  const [connections, setConnections] = useState<ConnectionUser[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsLabel, setConnectionsLabel] = useState("Followers");

  useEffect(() => {
    const loadStats = async () => {
      setIsLoading(true);
      try {
        const query = usernameParam ? `?username=${usernameParam}` : "";
        const response = await fetch(`/api/user/profile${query}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as ProfilePayload;
        if (typeof data.followersCount === "number") {
          setFollowersCount(data.followersCount);
        }
        if (typeof data.followingCount === "number") {
          setFollowingCount(data.followingCount);
        }
        if (typeof data.prayersLiftedCount === "number") {
          setPrayersLiftedCount(data.prayersLiftedCount);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };

    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ followersCount?: number }>).detail;
      if (typeof detail?.followersCount === "number") {
        setFollowersCount(detail.followersCount);
      }
    };

    const refreshListener = () => {
      loadStats();
    };

    window.addEventListener("follow:updated", listener);
    window.addEventListener("stats:refresh", refreshListener);
    loadStats();

    return () => {
      window.removeEventListener("follow:updated", listener);
      window.removeEventListener("stats:refresh", refreshListener);
    };
  }, [usernameParam]);

  const loadConnections = async (type: "followers" | "following") => {
    setConnectionsLoading(true);
    try {
      const params = new URLSearchParams({ type });
      if (usernameParam) params.set("username", usernameParam);
      const response = await fetch(`/api/user/connections?${params.toString()}`, {
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = (await response.json()) as ConnectionUser[];
      setConnections(data);
    } catch (error) {
      console.error(error);
    } finally {
      setConnectionsLoading(false);
    }
  };

  return (
    <div className="mt-6 flex flex-wrap gap-6 text-sm text-[color:var(--subtle)]">
      <div className="flex flex-col">
        <span>Prayers lifted</span>
        <span className="text-lg font-semibold text-[color:var(--ink)]">
          {prayersLiftedCount}
        </span>
      </div>
      <button
        type="button"
        onClick={() => {
          setConnectionsLabel("Followers");
          setShowFollowers(true);
          loadConnections("followers");
        }}
        className="flex flex-col text-left cursor-pointer hover:text-[color:var(--accent)]"
      >
        <span>Followers</span>
        {isLoading ? (
          <span className="mt-2 h-4 w-10 bg-slate-200 rounded-full animate-pulse" />
        ) : (
          <span className="text-lg font-semibold text-[color:var(--ink)]">
            {followersCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => {
          setConnectionsLabel("Following");
          setShowFollowing(true);
          loadConnections("following");
        }}
        className="flex flex-col text-left cursor-pointer hover:text-[color:var(--accent)]"
      >
        <span>Following</span>
        {isLoading ? (
          <span className="mt-2 h-4 w-10 bg-slate-200 rounded-full animate-pulse" />
        ) : (
          <span className="text-lg font-semibold text-[color:var(--ink)]">
            {followingCount}
          </span>
        )}
      </button>

      <Modal
        title={connectionsLabel}
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
            No {connectionsLabel.toLowerCase()} yet.
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
