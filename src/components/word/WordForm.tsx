"use client";

import { useEffect, useRef, useState } from "react";
import {
  Globe,
  ImageSquare,
  LockSimple,
  Plus,
  SpotifyLogo,
  UsersThree,
  X,
  YoutubeLogo,
} from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useUIStore } from "@/lib/uiStore";

type WordFormProps = {
  onPosted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
  showHeader?: boolean;
  placeholder?: string;
};

export default function WordForm({
  onPosted,
  onDirtyChange,
  compact = false,
  flat = false,
  variant = "modal",
  showHeader: _showHeader = true,
  placeholder = "What did God put on your heart today?",
}: WordFormProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const { setNewWordPosts } = useUIStore();
  const [content, setContent] = useState("");
  const [scriptureRef, setScriptureRef] = useState("");
  const [showScriptureRef, setShowScriptureRef] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [showSpotifyInput, setShowSpotifyInput] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState<"public" | "followers" | "private">("public");
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [imageItems, setImageItems] = useState<
    { file: File; previewUrl: string }[]
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const isFormDisabled = !isAuthenticated || isSubmitting;

  const openSignIn = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-signin"));
    }
  };

  const handleUnauthedTextClick = () => {
    if (!isAuthenticated) openSignIn();
  };
  const isDirty =
    content.trim().length > 0 ||
    imageItems.length > 0 ||
    scriptureRef.trim().length > 0 ||
    youtubeUrl.trim().length > 0 ||
    spotifyUrl.trim().length > 0 ||
    privacy !== "public";

  useEffect(() => {
    if (variant !== "modal") return;
    const id = setTimeout(() => {
      textAreaRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [variant]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    return () => {
      imageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    };
  }, [imageItems]);

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

    const maxSize = 1080;
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
        0.82
      );
    });

    return new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), {
      type: "image/jpeg",
    });
  };

  const handleSelectImages = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    const remaining = Math.max(0, 3 - imageItems.length);
    const nextFiles = files.slice(0, remaining);
    if (nextFiles.length === 0) {
      event.target.value = "";
      return;
    }

    try {
      const processed = await Promise.all(nextFiles.map((file) => resizeImage(file)));
      const nextItems = processed.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setImageItems((prev) => [...prev, ...nextItems]);
    } catch (error) {
      console.error(error);
      setSubmitError("Failed to prepare images. Try again.");
    } finally {
      event.target.value = "";
    }
  };

  const removeImage = (index: number) => {
    setImageItems((prev) => {
      const target = prev[index];
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setYoutubeError(null);
    setSpotifyError(null);

    if (!session?.user) {
      openSignIn();
      return;
    }

    if (
      !content.trim() &&
      imageItems.length === 0 &&
      !youtubeUrl.trim() &&
      !spotifyUrl.trim()
    ) {
      return;
    }

    const isValidYoutube = youtubeUrl.trim()
      ? /https?:\/\/(?:www\.)?(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([A-Za-z0-9_-]{6,})/i.test(
          youtubeUrl.trim()
        )
      : true;
    const isValidSpotify = spotifyUrl.trim()
      ? /https?:\/\/open\.spotify\.com\/(track|album|playlist|episode|show)\/[A-Za-z0-9]+/i.test(
          spotifyUrl.trim()
        )
      : true;

    if (!isValidYoutube) {
      setYoutubeError("Invalid YouTube link.");
      return;
    }
    if (!isValidSpotify) {
      setSpotifyError("Invalid Spotify link.");
      return;
    }

    setIsSubmitting(true);

    try {
      const mergedContent = [content.trim(), youtubeUrl.trim(), spotifyUrl.trim()]
        .filter(Boolean)
        .join("\n");
      let imageUrls: string[] = [];
      if (imageItems.length > 0) {
        const response = await fetch("/api/cloudinary/sign-word", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ count: imageItems.length }),
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          setSubmitError(payload?.error ?? "Failed to prepare uploads.");
          return;
        }

        const payload = (await response.json()) as {
          cloudName: string;
          apiKey: string;
          uploads: {
            publicId: string;
            signature: string;
            timestamp: number;
            folder: string;
            invalidate: string;
          }[];
        };
        const uploads = payload.uploads ?? [];
        const uploadResponses = await Promise.all(
          uploads.map(async (upload, index) => {
            const file = imageItems[index]?.file;
            if (!file) return null;
            const formData = new FormData();
            formData.append("file", file);
            formData.append("api_key", payload.apiKey);
            formData.append("timestamp", String(upload.timestamp));
            formData.append("signature", upload.signature);
            formData.append("folder", upload.folder);
            formData.append("public_id", upload.publicId);
            formData.append("invalidate", upload.invalidate);

            const uploadResponse = await fetch(
              `https://api.cloudinary.com/v1_1/${payload.cloudName}/image/upload`,
              {
                method: "POST",
                body: formData,
              }
            );
            if (!uploadResponse.ok) {
              return null;
            }
            return (await uploadResponse.json()) as { secure_url?: string };
          })
        );
        const secureUrls = uploadResponses
          .map((res) => res?.secure_url)
          .filter((url): url is string => Boolean(url));
        if (secureUrls.length !== imageItems.length) {
          setSubmitError("Failed to upload images. Try again.");
          return;
        }
        imageUrls = secureUrls;
      }

      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: mergedContent,
          images: imageUrls,
          scriptureRef: scriptureRef.trim(),
          privacy,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setSubmitError(payload?.error ?? "Failed to post word.");
        return;
      }

      setContent("");
      setScriptureRef("");
      setShowScriptureRef(false);
      setYoutubeUrl("");
      setSpotifyUrl("");
      setShowYoutubeInput(false);
      setShowSpotifyInput(false);
      setPrivacy("public");
      setShowPrivacyMenu(false);
      imageItems.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      setImageItems([]);
      setNewWordPosts(false);
      onPosted?.();
      onDirtyChange?.(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("feed:refresh"));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      data-show-header={_showHeader ? "true" : "false"}
      className={`${
      variant === "modal" ? "modal-form" : flat ? "feed-form" : "panel-glass"
    } flex flex-col gap-2 ${
        compact ? "p-3" : "p-4"
      } pb-0`}
    >
      <textarea
        className={`bg-transparent text-base text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none ${
          compact ? "min-h-[28px]" : "min-h-[36px]"
        }`}
        placeholder={placeholder}
        value={content}
        ref={textAreaRef}
        readOnly={!isAuthenticated}
        aria-disabled={!isAuthenticated}
        onClick={handleUnauthedTextClick}
        onFocus={handleUnauthedTextClick}
        onChange={(event) => {
          setContent(event.target.value);
          if (textAreaRef.current) {
            textAreaRef.current.style.height = "auto";
            textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
          }
        }}
      />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 relative">
          <button
            type="button"
            onClick={() => setShowScriptureRef((prev) => !prev)}
            disabled={isFormDisabled}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            aria-label="Add verse reference"
          >
            <Plus size={14} weight="regular" />
            Verse
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isFormDisabled}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            aria-label="Add images"
          >
            <ImageSquare size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (youtubeUrl.trim()) {
                setShowYoutubeInput(true);
                return;
              }
              setShowYoutubeInput((prev) => !prev);
            }}
            disabled={isFormDisabled || Boolean(spotifyUrl.trim())}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Add YouTube link"
          >
            <YoutubeLogo size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (spotifyUrl.trim()) {
                setShowSpotifyInput(true);
                return;
              }
              setShowSpotifyInput((prev) => !prev);
            }}
            disabled={isFormDisabled || Boolean(youtubeUrl.trim())}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label="Add Spotify link"
          >
            <SpotifyLogo size={16} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => setShowPrivacyMenu((prev) => !prev)}
            disabled={isFormDisabled}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            aria-label="Post privacy"
          >
            {privacy === "public" ? (
              <Globe size={16} weight="regular" />
            ) : privacy === "followers" ? (
              <UsersThree size={16} weight="regular" />
            ) : (
              <LockSimple size={16} weight="regular" />
            )}
          </button>
          {showPrivacyMenu && (
            <div className="absolute left-0 top-7 z-10 min-w-[180px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
              <button
                type="button"
                onClick={() => {
                  setPrivacy("public");
                  setShowPrivacyMenu(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)]"
              >
                Share to All
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrivacy("followers");
                  setShowPrivacyMenu(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)]"
              >
                Followers only
              </button>
              <button
                type="button"
                onClick={() => {
                  setPrivacy("private");
                  setShowPrivacyMenu(false);
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface)]"
              >
                Only me
              </button>
            </div>
          )}
        </div>
        <span className="text-[11px] text-[color:var(--subtle)]">
          {imageItems.length}/3
        </span>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        disabled={isFormDisabled}
        onChange={handleSelectImages}
      />
      {imageItems.length > 0 && (
        <div className="flex gap-2 overflow-x-auto">
          {imageItems.map((item, index) => (
            <div
              key={`${item.previewUrl}-${index}`}
              className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--surface-strong)]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.previewUrl}
                alt="Selected"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(index)}
                disabled={isFormDisabled}
                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                aria-label="Remove image"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          ))}
        </div>
      )}
      {showScriptureRef && (
        <input
          type="text"
          className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
          placeholder="Scripture reference"
          value={scriptureRef}
          readOnly={!isAuthenticated}
          aria-disabled={!isAuthenticated}
          onClick={handleUnauthedTextClick}
          onFocus={handleUnauthedTextClick}
          onChange={(event) => setScriptureRef(event.target.value)}
        />
      )}
      {showYoutubeInput && (
        <input
          type="url"
          className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
          placeholder="Paste YouTube link"
          value={youtubeUrl}
          readOnly={!isAuthenticated}
          aria-disabled={!isAuthenticated}
          onClick={handleUnauthedTextClick}
          onFocus={handleUnauthedTextClick}
          onChange={(event) => {
            setYoutubeUrl(event.target.value);
            if (youtubeError) setYoutubeError(null);
          }}
        />
      )}
      {youtubeError && (
        <p className="text-xs text-[color:var(--danger)]">{youtubeError}</p>
      )}
      {showSpotifyInput && (
        <input
          type="url"
          className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
          placeholder="Paste Spotify link"
          value={spotifyUrl}
          readOnly={!isAuthenticated}
          aria-disabled={!isAuthenticated}
          onClick={handleUnauthedTextClick}
          onFocus={handleUnauthedTextClick}
          onChange={(event) => {
            setSpotifyUrl(event.target.value);
            if (spotifyError) setSpotifyError(null);
          }}
        />
      )}
      {spotifyError && (
        <p className="text-xs text-[color:var(--danger)]">{spotifyError}</p>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isFormDisabled ||
            (!content.trim() &&
              imageItems.length === 0 &&
              !youtubeUrl.trim() &&
              !spotifyUrl.trim())
          }
          className="post-button disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>
      {submitError && (
        <p className="text-xs text-[color:var(--danger)]">{submitError}</p>
      )}
    </form>
  );
}
