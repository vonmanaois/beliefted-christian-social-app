"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import Image from "next/image";
import { UserSquare } from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import Button from "@/components/ui/Button";
import { cloudinaryTransform } from "@/lib/cloudinary";

type ProfileSettingsProps = {
  currentUsername?: string | null;
  required?: boolean;
  currentName?: string | null;
  currentBio?: string | null;
  currentImage?: string | null;
  showPhoto?: boolean;
  onUpdated?: () => void;
  showDangerZone?: boolean;
  submitDisabled?: boolean;
  submitDisabledMessage?: string | null;
};

const compressToSquare = (file: File, size: number, quality: number) =>
  new Promise<Blob>((resolve, reject) => {
    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      const minSide = Math.min(img.width, img.height);
      const sx = (img.width - minSide) / 2;
      const sy = (img.height - minSide) / 2;

      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Failed to process image."));
        return;
      }

      ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (!blob) {
            reject(new Error("Failed to process image."));
            return;
          }
          resolve(blob);
        },
        "image/jpeg",
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to load image."));
    };

    img.src = objectUrl;
  });

export default function ProfileSettings({
  currentUsername,
  required = false,
  currentName,
  currentBio,
  currentImage,
  showPhoto = false,
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
  const [imageChanged, setImageChanged] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "ok" | "taken">(
    "idle"
  );

  // Initial values come from props; updates are applied on save.

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

  const uploadProfileImage = async (file: File) => {
    setImageError(null);
    setMessage(null);
    setIsUploading(true);

    try {
      if (!file.type.startsWith("image/")) {
        throw new Error("Please choose an image file.");
      }

      const preparedBlob = await compressToSquare(file, 512, 0.82);
      const signResponse = await fetch("/api/cloudinary/sign", { method: "POST" });
      if (!signResponse.ok) {
        throw new Error("Failed to prepare upload.");
      }
      const signData = (await signResponse.json()) as {
        cloudName: string;
        apiKey: string;
        timestamp: number;
        folder: string;
        publicId: string;
        invalidate: string;
        signature: string;
      };

      const formData = new FormData();
      formData.append("file", preparedBlob, "profile.jpg");
      formData.append("api_key", signData.apiKey);
      formData.append("timestamp", String(signData.timestamp));
      formData.append("signature", signData.signature);
      formData.append("folder", signData.folder);
      formData.append("public_id", signData.publicId);
      formData.append("invalidate", signData.invalidate);

      const uploadResponse = await fetch(
        `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );
      const uploadData = (await uploadResponse.json()) as {
        secure_url?: string;
        url?: string;
        error?: { message?: string };
      };
      if (!uploadResponse.ok) {
        throw new Error(uploadData.error?.message || "Upload failed.");
      }

      const uploadedUrl = uploadData.secure_url ?? uploadData.url;
      if (!uploadedUrl) {
        throw new Error("Upload failed.");
      }
      setImage(uploadedUrl);
      setImageChanged(true);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setIsSaving(true);
    setImageError(null);

    try {
      const payload: {
        username: string;
        name: string;
        bio: string;
        image?: string | null;
      } = {
        username: username.trim(),
        name: name.trim(),
        bio: bio.trim(),
      };
      if (showPhoto && imageChanged) {
        payload.image = image.trim() ? image.trim() : null;
      }

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
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
      setImageChanged(false);
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
      {showPhoto && (
        <>
          <div>
            <p className="text-sm font-semibold text-[color:var(--ink)]">Photo</p>
            <p className="text-xs text-[color:var(--subtle)]">
              Upload a square image. We optimize it automatically.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-[color:var(--surface-strong)] flex items-center justify-center overflow-hidden">
              {image ? (
                <Image
                  src={cloudinaryTransform(image, { width: 120, height: 120 })}
                  alt="Profile"
                  width={120}
                  height={120}
                  sizes="56px"
                  className="h-full w-full object-cover"
                />
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
                    if (file.size > 10_000_000) {
                      setImageError("Image must be under 10 MB.");
                      return;
                    }
                    void uploadProfileImage(file);
                  }}
                />
                <span className="pill-button inline-flex items-center">
                  {isUploading ? "Uploading..." : "Upload image"}
                </span>
              </label>
              {imageChanged && image && (
                <button
                  type="button"
                  className="text-xs text-[color:var(--subtle)] underline underline-offset-2"
                  onClick={() => {
                    setImage("");
                    setImageChanged(true);
                  }}
                >
                  Remove photo
                </button>
              )}
              {imageError && (
                <p className="text-xs text-[color:var(--danger)]">{imageError}</p>
              )}
            </div>
          </div>
        </>
      )}
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
          disabled={isSaving || isUploading || submitDisabled}
          variant="solid"
          size={required ? "sm" : "md"}
        >
          {isSaving ? "Updating..." : isUploading ? "Uploading..." : "Update profile"}
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
