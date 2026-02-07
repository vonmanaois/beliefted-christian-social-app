"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Modal from "@/components/layout/Modal";

type ProfileSettingsProps = {
  currentUsername?: string | null;
  required?: boolean;
  currentName?: string | null;
  currentBio?: string | null;
  onUpdated?: () => void;
};

export default function ProfileSettings({
  currentUsername,
  required = false,
  currentName,
  currentBio,
  onUpdated,
}: ProfileSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName ?? "");
  const [username, setUsername] = useState(currentUsername ?? "");
  const [bio, setBio] = useState(currentBio ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          name?: string | null;
          username?: string | null;
          bio?: string | null;
        };
        if (typeof data.name === "string") setName(data.name);
        if (typeof data.username === "string") setUsername(data.username);
        if (typeof data.bio === "string") setBio(data.bio);
      } catch (error) {
        console.error(error);
      }
    };

    loadProfile();
  }, []);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim(),
          bio: bio.trim(),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        username?: string;
        name?: string;
        bio?: string;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (typeof data.name === "string") setName(data.name);
      if (typeof data.username === "string") setUsername(data.username);
      if (typeof data.bio === "string") setBio(data.bio);
      setMessage("Profile updated successfully.");
      window.dispatchEvent(new Event("profile:updated"));
      onUpdated?.();
      router.refresh();
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
        <p className="text-sm font-semibold text-[color:var(--ink)]">Bio</p>
        <p className="text-xs text-[color:var(--subtle)]">
          280 characters max.
        </p>
      </div>
      <textarea
        className="soft-input text-sm min-h-[90px]"
        placeholder="Share a short bio..."
        value={bio}
        onChange={(event) => setBio(event.target.value)}
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
        <span className="text-xs text-[color:var(--subtle)]">
          @{username || "username"}
        </span>
        <button
          type="submit"
          disabled={isSaving}
          className="pill-button bg-[color:var(--accent)] text-[color:var(--accent-contrast)] disabled:opacity-60 cursor-pointer"
        >
          {isSaving ? "Updating..." : "Update profile"}
        </button>
      </div>
      {message && <p className="text-xs text-[color:var(--subtle)]">{message}</p>}

      <div className="mt-4 border-t border-[color:var(--panel-border)] pt-4">
        <p className="text-sm font-semibold text-[color:var(--ink)]">Danger Zone</p>
        <p className="text-xs text-[color:var(--subtle)]">
          Deleting your account is permanent and cannot be undone.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
          className="mt-3 rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--danger)] border border-[color:var(--danger)] cursor-pointer"
        >
          Delete account
        </button>
      </div>

      <Modal
        title="Delete account?"
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          This will permanently delete your account, prayers, words, and comments.
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              setIsDeleting(true);
              try {
                const response = await fetch("/api/user/account", {
                  method: "DELETE",
                });
                if (!response.ok) {
                  throw new Error("Failed to delete account");
                }
                await signOut({ callbackUrl: "/" });
              } catch (error) {
                setMessage(
                  error instanceof Error ? error.message : "Something went wrong"
                );
              } finally {
                setIsDeleting(false);
                setShowDeleteConfirm(false);
              }
            }}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-white bg-[color:var(--danger)] cursor-pointer"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </form>
  );
}
