"use client";

import { useState } from "react";

type ProfileSettingsProps = {
  currentUsername?: string | null;
  required?: boolean;
  currentName?: string | null;
};

export default function ProfileSettings({
  currentUsername,
  required = false,
  currentName,
}: ProfileSettingsProps) {
  const [name, setName] = useState(currentName ?? "");
  const [username, setUsername] = useState(currentUsername ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), name: name.trim() }),
      });

      const data = (await response.json()) as { error?: string; username?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setMessage("Username saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="panel p-4 flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold text-[color:var(--ink)]">Name</p>
        <p className="text-xs text-[color:var(--subtle)]">
          This is what people will see first.
        </p>
      </div>
      <input
        className="soft-input text-sm"
        placeholder="Your name"
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <div>
        <p className="text-sm font-semibold text-[color:var(--ink)]">
          Username
        </p>
        <p className="text-xs text-[color:var(--subtle)]">
          {required
            ? "You must choose a unique username to continue."
            : "3–20 chars, lowercase letters, numbers, underscore."}
        </p>
      </div>
      <input
        className="soft-input text-sm"
        placeholder="username"
        value={username}
        onChange={(event) => setUsername(event.target.value)}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-[color:var(--subtle)]">@{username || "username"}</span>
        <button
          type="submit"
          disabled={isSaving}
          className="pill-button bg-[color:var(--accent)] text-white disabled:opacity-60 cursor-pointer"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
      {message && <p className="text-xs text-[color:var(--subtle)]">{message}</p>}
    </form>
  );
}
