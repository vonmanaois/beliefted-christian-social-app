"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageSquare, X } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import FaithStoryEditor from "@/components/faith/FaithStoryEditor";

type FaithStoryFormProps = {
  initialTitle?: string;
  initialContent?: string;
  initialAnonymous?: boolean;
  onSubmit: (
    title: string,
    content: string,
    isAnonymous: boolean,
    coverImage?: string | null
  ) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function FaithStoryForm({
  initialTitle = "",
  initialContent = "",
  initialAnonymous = false,
  onSubmit,
  onCancel,
  submitLabel = "Publish",
  onDirtyChange,
}: FaithStoryFormProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const [title, setTitle] = useState(initialTitle);
  const normalizedInitialContent = useMemo(() => {
    const trimmed = initialContent.trim();
    if (!trimmed) return "";
    if (trimmed.includes("<")) return trimmed;
    return `<p>${trimmed.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p>`;
  }, [initialContent]);
  const [content, setContent] = useState(normalizedInitialContent);
  const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const plainContent = useMemo(() => {
    const noTags = content.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
    return noTags.replace(/\s+/g, " ").trim();
  }, [content]);
  const isDirty =
    title.trim() !== initialTitle.trim() ||
    content.trim() !== normalizedInitialContent.trim() ||
    isAnonymous !== initialAnonymous ||
    Boolean(coverImage);

  const openSignIn = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-signin"));
    }
  };

  const handleUnauthedTextClick = () => {
    if (!isAuthenticated) openSignIn();
  };

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const resizeImage = async (file: File) => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Failed to load image"));
      image.src = dataUrl;
    });

    const maxSize = 1200;
    let targetWidth = img.width;
    let targetHeight = img.height;
    if (targetWidth > targetHeight && targetWidth > maxSize) {
      targetHeight = Math.round((targetHeight * maxSize) / targetWidth);
      targetWidth = maxSize;
    } else if (targetHeight > maxSize) {
      targetWidth = Math.round((targetWidth * maxSize) / targetHeight);
      targetHeight = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }
    ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (!result) {
            reject(new Error("Failed to compress image"));
          } else {
            resolve(result);
          }
        },
        "image/jpeg",
        0.84
      );
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  };

  const handleCoverChange = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const processed = await resizeImage(file);
      if (coverPreview) URL.revokeObjectURL(coverPreview);
      setCoverImage(processed);
      setCoverPreview(URL.createObjectURL(processed));
    } catch {
      setError("Failed to prepare image.");
    } finally {
      event.target.value = "";
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    if (!title.trim() || !plainContent) {
      setError("Title and story are required.");
      return;
    }
    if (!coverImage) {
      setError("Please add a cover image to publish your story.");
      return;
    }
    setIsSaving(true);
    try {
      let coverUrl: string | null = null;
      if (coverImage) {
        const signResponse = await fetch("/api/cloudinary/sign-faith-story", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: 1 }),
        });
        if (!signResponse.ok) {
          setError("Failed to prepare upload.");
          return;
        }
        const signData = (await signResponse.json()) as {
          cloudName: string;
          apiKey: string;
          upload: {
            publicId: string;
            signature: string;
            timestamp: number;
            folder: string;
            invalidate: string;
          };
        };
        const formData = new FormData();
        formData.append("file", coverImage);
        formData.append("api_key", signData.apiKey);
        formData.append("timestamp", String(signData.upload.timestamp));
        formData.append("signature", signData.upload.signature);
        formData.append("folder", signData.upload.folder);
        formData.append("public_id", signData.upload.publicId);
        formData.append("invalidate", signData.upload.invalidate);

        const uploadResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`,
          { method: "POST", body: formData }
        );
        if (!uploadResponse.ok) {
          setError("Failed to upload cover image.");
          return;
        }
        const uploaded = (await uploadResponse.json()) as {
          secure_url?: string;
          url?: string;
        };
        coverUrl = uploaded.secure_url ?? uploaded.url ?? null;
        if (!coverUrl) {
          setError("Upload succeeded but no image URL returned.");
          return;
        }
      }

      await onSubmit(title.trim(), content.trim(), isAnonymous, coverUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        className="bg-transparent text-2xl font-semibold text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-3 focus:outline-none focus:ring-0 focus:border-[color:var(--panel-border)] text-center"
        placeholder="Title"
        value={title}
        readOnly={!isAuthenticated}
        aria-disabled={!isAuthenticated}
        onClick={handleUnauthedTextClick}
        onFocus={handleUnauthedTextClick}
        onChange={(event) => setTitle(event.target.value)}
      />
      <FaithStoryEditor
        value={content}
        onChange={setContent}
        disabled={!isAuthenticated || isSaving}
        placeholder="Share your faith story..."
        maxImages={2}
        onError={(message) => setError(message)}
      />
      <div className="flex items-center gap-3 text-xs text-[color:var(--subtle)]">
        <button
          type="button"
          onClick={() => coverInputRef.current?.click()}
          disabled={!isAuthenticated || isSaving}
          className="inline-flex items-center gap-2 font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
        >
          <ImageSquare size={18} weight="regular" />
          Cover
        </button>
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          disabled={!isAuthenticated || isSaving}
          onChange={handleCoverChange}
        />
        {coverPreview && (
          <div className="relative h-16 w-24 overflow-hidden rounded-lg border border-[color:var(--panel-border)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={coverPreview} alt="Cover preview" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => {
                if (coverPreview) URL.revokeObjectURL(coverPreview);
                setCoverPreview(null);
                setCoverImage(null);
              }}
              disabled={!isAuthenticated || isSaving}
              className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              aria-label="Remove cover image"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-[color:var(--danger)]">{error}</p>}
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] cursor-pointer">
        <input
          type="checkbox"
          checked={isAnonymous}
          disabled={!isAuthenticated || isSaving}
          onChange={(event) => setIsAnonymous(event.target.checked)}
          className="h-4 w-4"
        />
        Post anonymously
      </label>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!isAuthenticated || isSaving}
          className="post-button disabled:opacity-60"
        >
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
