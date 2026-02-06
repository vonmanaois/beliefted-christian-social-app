"use client";

import { useEffect, useState } from "react";

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
  const [name, setName] = useState(initialName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio ?? "");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const query = usernameParam ? `?username=${usernameParam}` : "";
        const response = await fetch(`/api/user/profile${query}`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as ProfilePayload;
        if (data.name) setName(data.name);
        if (data.username) setUsername(data.username);
        if (typeof data.bio === "string") setBio(data.bio);
      } catch (error) {
        console.error(error);
      }
    };

    loadProfile();
  }, [usernameParam]);

  return (
    <div>
      <p className="text-3xl font-semibold text-[color:var(--ink)]">{name}</p>
      <p className="mt-2 text-sm text-[color:var(--subtle)]">@{username}</p>
      {bio ? (
        <p className="mt-2 text-sm text-[color:var(--subtle)]">{bio}</p>
      ) : null}
    </div>
  );
}
