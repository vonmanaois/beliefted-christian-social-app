"use client";

import Image from "next/image";
import { useState } from "react";
import { UserSquare } from "@phosphor-icons/react";
import { cloudinaryTransform } from "@/lib/cloudinary";

type ProfilePhotoUploadProps = {
  image: string;
  imageChanged: boolean;
  onImageChange: (next: string) => void;
  onImageChanged: (next: boolean) => void;
  onUploadingChange: (next: boolean) => void;
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

export default function ProfilePhotoUpload({
  image,
  imageChanged,
  onImageChange,
  onImageChanged,
  onUploadingChange,
}: ProfilePhotoUploadProps) {
  const [imageError, setImageError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const setUploading = (next: boolean) => {
    setIsUploading(next);
    onUploadingChange(next);
  };

  const uploadProfileImage = async (file: File) => {
    setImageError(null);
    setUploading(true);

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
      onImageChange(uploadedUrl);
      onImageChanged(true);
    } catch (error) {
      setImageError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  return (
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
                onImageChange("");
                onImageChanged(true);
              }}
            >
              Remove photo
            </button>
          )}
          {imageError && <p className="text-xs text-[color:var(--danger)]">{imageError}</p>}
        </div>
      </div>
    </>
  );
}
