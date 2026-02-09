"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { UserSquare } from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import Button from "@/components/ui/Button";

type ProfileSettingsProps = {
  currentUsername?: string | null;
  required?: boolean;
  currentName?: string | null;
  currentBio?: string | null;
  currentImage?: string | null;
  onUpdated?: () => void;
  showDangerZone?: boolean;
  submitDisabled?: boolean;
  submitDisabledMessage?: string | null;
};

export default function ProfileSettings({
  currentUsername,
  required = false,
  currentName,
  currentBio,
  currentImage,
  onUpdated,
  showDangerZone = true,
  submitDisabled = false,
  submitDisabledMessage = null,
}: ProfileSettingsProps) {
  const router = useRouter();
  const [name, setName] = useState(currentName ?? "");
  const [username, setUsername] = useState(currentUsername ?? "");
  const [bio, setBio] = useState(currentBio ?? "");
  const [image, setImage] = useState(currentImage ?? "");
  const [imageError, setImageError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken">(
    "idle"
  );

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          name?: string | null;
          username?: string | null;
          bio?: string | null;
          image?: string | null;
        };
        if (typeof data.name === "string") setName(data.name);
        if (typeof data.username === "string") setUsername(data.username);
        if (typeof data.bio === "string") setBio(data.bio);
        if (typeof data.image === "string") setImage(data.image);
      } catch (error) {
        console.error(error);
      }
    };

    loadProfile();
  }, []);

  useEffect(() => {
    const trimmed = username.trim();
    if (currentUsername && trimmed === currentUsername) {
      setUsernameStatus("idle");
      return;
    }
    if (!trimmed) {
      setUsernameStatus("idle");
      return;
    }
    const timer = setTimeout(async () => {
      setUsernameStatus("checking");
      try {
        const response = await fetch(`/api/user/username?username=${trimmed}`);
        if (!response.ok) {
          setUsernameStatus("idle");
          return;
        }
        const data = (await response.json()) as { available?: boolean };
        setUsernameStatus(data.available ? "ok" : "taken");
      } catch {
        setUsernameStatus("idle");
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [username, currentUsername]);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    setImageError(null);

    try {
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          name: name.trim(),
          bio: bio.trim(),
          image: image.trim(),
        }),
      });

      const data = (await response.json()) as {
        error?: string;
        username?: string;
        name?: string;
        bio?: string;
        image?: string | null;
      };

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (typeof data.name === "string") setName(data.name);
      if (typeof data.username === "string") setUsername(data.username);
      if (typeof data.bio === "string") setBio(data.bio);
      if (typeof data.image === "string" || data.image === null) {
        setImage(data.image ?? "");
      }
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
        <p className="text-sm font-semibold text-[color:var(--ink)]">Photo</p>
        <p className="text-xs text-[color:var(--subtle)]">
          Upload a square image (max 1 MB).
        </p>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-full bg-[color:var(--surface-strong)] flex items-center justify-center overflow-hidden">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <UserSquare size={28} weight="regular" className="text-[color:var(--subtle)]" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[color:var(--ink)] cursor-pointer">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (file.size > 1_000_000) {
                  setImageError("Image must be under 1 MB.");
                  return;
                }
                const reader = new FileReader();
                reader.onload = () => {
                  if (typeof reader.result === "string") {
                    setImage(reader.result);
                  }
                };
                reader.readAsDataURL(file);
              }}
            />
            <span className="pill-button inline-flex items-center">
              Upload image
            </span>
          </label>
          {image && (
            <button
              type="button"
              className="text-xs text-[color:var(--subtle)] underline underline-offset-2"
              onClick={() => setImage("")}
            >
              Remove photo
            </button>
          )}
          {imageError && (
            <p className="text-xs text-[color:var(--danger)]">{imageError}</p>
          )}
        </div>
      </div>
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
        <span className="text-xs">
          {usernameStatus === "checking" && (
            <span className="text-[color:var(--subtle)]">Checking...</span>
          )}
          {usernameStatus === "ok" && (
            <span className="text-green-600">Username is available</span>
          )}
          {usernameStatus === "taken" && (
            <span className="text-[color:var(--danger)]">
              Username already exists
            </span>
          )}
        </span>
        <Button
          type="submit"
          disabled={isSaving || submitDisabled}
          variant="solid"
          size={required ? "sm" : "md"}
        >
          {isSaving ? "Updating..." : "Update profile"}
        </Button>
      </div>
      {submitDisabled && submitDisabledMessage && (
        <p className="text-xs text-[color:var(--subtle)]">
          {submitDisabledMessage}
        </p>
      )}
      {message && <p className="text-xs text-[color:var(--subtle)]">{message}</p>}

      {showDangerZone && (
        <div className="mt-4 border-t border-[color:var(--panel-border)] pt-4">
          <p className="text-sm font-semibold text-[color:var(--ink)]">Danger Zone</p>
        <p className="text-xs text-[color:var(--subtle)]">
          Account deletion has a 30-day grace period. Signing back in will restore it.
        </p>
          <Button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            variant="outline"
            size="sm"
            className="mt-3 border-[color:var(--danger)] text-[color:var(--danger)]"
          >
            Delete account
          </Button>
        </div>
      )}

      {showDangerZone && (
        <Modal
          title="Delete account?"
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
        >
        <p className="text-sm text-[color:var(--subtle)]">
          This will schedule your account for deletion. You can restore it by signing in within 30 days.
        </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <Button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              variant="ghost"
              size="sm"
            >
              Cancel
            </Button>
            <Button
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
              variant="solid"
              size="sm"
              className="bg-[color:var(--danger)] text-white"
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </Modal>
      )}
    </form>
  );
}
