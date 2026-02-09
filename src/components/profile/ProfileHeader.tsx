"use client";

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type ProfileHeaderProps = {
  initialName: string;
  initialUsername: string;
  initialBio?: string | null;
  usernameParam?: string | null;
};

type ProfilePayload = {
  name?: string | null;
  username?: string | null;
  bio?: string | null;
};

export default function ProfileHeader({
  initialName,
  initialUsername,
  initialBio,
  usernameParam,
}: ProfileHeaderProps) {
  const queryClient = useQueryClient();
  const profileKey = useMemo(
    () =>
      usernameParam
        ? (["profile", "summary", usernameParam] as const)
        : (["profile", "summary"] as const),
    [usernameParam]
  );

  const { data: profile } = useQuery({
    queryKey: profileKey,
    queryFn: async () => {
      const query = usernameParam ? `?username=${usernameParam}` : "";
      const response = await fetch(`/api/user/profile${query}`, {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error("Failed to load profile");
      }
      return (await response.json()) as ProfilePayload;
    },
    initialData: {
      name: initialName,
      username: initialUsername,
      bio: initialBio ?? "",
    },
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const listener = () => {
      queryClient.invalidateQueries({ queryKey: profileKey });
    };

    window.addEventListener("profile:updated", listener);

    return () => window.removeEventListener("profile:updated", listener);
  }, [profileKey, queryClient]);

  return (
    <div>
      <p className="text-2xl font-semibold text-[color:var(--ink)]">
        {profile?.name ?? initialName}
      </p>
      <p className="mt-2 text-sm text-[color:var(--subtle)]">
        @{profile?.username ?? initialUsername}
      </p>
      {profile?.bio ? (
        <p className="mt-2 text-sm text-[color:var(--ink)] whitespace-pre-line">
          {profile.bio}
        </p>
      ) : null}
    </div>
  );
}
