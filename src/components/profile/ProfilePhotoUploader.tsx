"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Camera } from "@phosphor-icons/react";
import { cloudinaryTransform } from "@/lib/cloudinary";

type ProfilePhotoUploaderProps = {
  currentImage?: string | null;
  currentName?: string | null;
  currentUsername?: string | null;
  currentBio?: string | null;
  size?: number;
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

export default function ProfilePhotoUploader({
  currentImage,
  currentName,
  currentUsername,
  currentBio,
  size = 80,
}: ProfilePhotoUploaderProps) {
  const router = useRouter();
  const [image, setImage] = useState(currentImage ?? "");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canUpdate = Boolean(currentUsername && currentUsername.length >= 3);

  useEffect(() => {
    setImage(currentImage ?? "");
  }, [currentImage]);

  const handleUpload = async (file: File) => {
    setError(null);
    setIsUploading(true);
    try {
      if (!canUpdate) {
        throw new Error("Set a username before updating your photo.");
      }
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

      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: currentUsername ?? "",
          name: currentName ?? "",
          bio: currentBio ?? "",
          image: uploadedUrl,
        }),
      });
      const data = (await response.json()) as { image?: string | null; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile photo");
      }

      setImage(data.image ?? uploadedUrl);
      window.dispatchEvent(new Event("profile:updated"));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="relative">
      <div
        className="rounded-full overflow-hidden bg-slate-200"
        style={{ width: size, height: size }}
      >
        {image ? (
          <Image
            src={cloudinaryTransform(image, { width: size * 2, height: size * 2 })}
            alt="Profile"
            width={size * 2}
            height={size * 2}
            sizes={`${size}px`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-[color:var(--subtle)]">
            <Camera size={Math.round(size * 0.45)} weight="regular" />
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] text-[color:var(--ink)] hover:text-[color:var(--accent)] flex items-center justify-center"
        aria-label="Change profile photo"
        disabled={isUploading || !canUpdate}
      >
        <Camera size={16} weight="bold" />
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > 10_000_000) {
            setError("Image must be under 10 MB.");
            return;
          }
          void handleUpload(file);
        }}
      />
      {error && <p className="mt-2 text-xs text-[color:var(--danger)]">{error}</p>}
    </div>
  );
}
