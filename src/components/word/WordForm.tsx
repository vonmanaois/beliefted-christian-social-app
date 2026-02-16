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
import MentionTextarea from "@/components/ui/MentionTextarea";

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

  const getExifOrientation = async (file: File) => {
    const buffer = await file.arrayBuffer();
    const view = new DataView(buffer);
    if (view.byteLength < 12) return 1;
    if (view.getUint16(0, false) !== 0xffd8) return 1;
    let offset = 2;
    while (offset + 4 < view.byteLength) {
      const marker = view.getUint16(offset, false);
      if (marker === 0xffe1) {
        const exifHeader = String.fromCharCode(
          view.getUint8(offset + 4),
          view.getUint8(offset + 5),
          view.getUint8(offset + 6),
          view.getUint8(offset + 7)
        );
        if (exifHeader !== "Exif") return 1;
        const tiffOffset = offset + 10;
        const endian = view.getUint16(tiffOffset, false);
        const little = endian === 0x4949;
        const firstIfdOffset = view.getUint32(tiffOffset + 4, little);
        if (firstIfdOffset < 8) return 1;
        const ifdStart = tiffOffset + firstIfdOffset;
        const entries = view.getUint16(ifdStart, little);
        for (let i = 0; i < entries; i += 1) {
          const entryOffset = ifdStart + 2 + i * 12;
          const tag = view.getUint16(entryOffset, little);
          if (tag === 0x0112) {
            return view.getUint16(entryOffset + 8, little);
          }
        }
        return 1;
      }
      if ((marker & 0xff00) !== 0xff00) break;
      const size = view.getUint16(offset + 2, false);
      offset += 2 + size;
    }
    return 1;
  };

  const resizeImage = async (file: File) => {
    const orientation = await getExifOrientation(file);
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

    const rawWidth = img.naturalWidth || img.width;
    const rawHeight = img.naturalHeight || img.height;
    const autoOriented =
      orientation >= 5 && orientation <= 8 && rawHeight > rawWidth;
    const effectiveOrientation = autoOriented ? 1 : orientation;
    const rotates = effectiveOrientation >= 5 && effectiveOrientation <= 8;
    const orientedWidth = rotates ? rawHeight : rawWidth;
    const orientedHeight = rotates ? rawWidth : rawHeight;

    const maxSize = 1080;
    let targetWidth = orientedWidth;
    let targetHeight = orientedHeight;
    if (targetWidth > targetHeight && targetWidth > maxSize) {
      targetHeight = Math.round((targetHeight * maxSize) / targetWidth);
      targetWidth = maxSize;
    } else if (targetHeight > maxSize) {
      targetWidth = Math.round((targetWidth * maxSize) / targetHeight);
      targetHeight = maxSize;
    }

    const canvas = document.createElement("canvas");
    canvas.width = rotates ? targetHeight : targetWidth;
    canvas.height = rotates ? targetWidth : targetHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas not supported");
    }
    switch (effectiveOrientation) {
      case 2:
        ctx.setTransform(-1, 0, 0, 1, canvas.width, 0);
        break;
      case 3:
        ctx.setTransform(-1, 0, 0, -1, canvas.width, canvas.height);
        break;
      case 4:
        ctx.setTransform(1, 0, 0, -1, 0, canvas.height);
        break;
      case 5:
        ctx.setTransform(0, 1, 1, 0, 0, 0);
        break;
      case 6:
        ctx.setTransform(0, 1, -1, 0, canvas.width, 0);
        break;
      case 7:
        ctx.setTransform(0, -1, -1, 0, canvas.width, canvas.height);
        break;
      case 8:
        ctx.setTransform(0, -1, 1, 0, 0, canvas.height);
        break;
      default:
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        break;
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
    const remaining = Math.max(0, 4 - imageItems.length);
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

  const handlePasteImages = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>
  ) => {
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    const items = Array.from(event.clipboardData?.items ?? []);
    const imageItemsFromClipboard = items.filter((item) =>
      item.type.startsWith("image/")
    );
    if (imageItemsFromClipboard.length === 0) return;
    event.preventDefault();
    const remaining = Math.max(0, 4 - imageItems.length);
    if (remaining === 0) return;
    const files = imageItemsFromClipboard
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file))
      .slice(0, remaining);
    if (files.length === 0) return;
    try {
      const processed = await Promise.all(files.map((file) => resizeImage(file)));
      const nextItems = processed.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      setImageItems((prev) => [...prev, ...nextItems]);
    } catch (error) {
      console.error(error);
      setSubmitError("Failed to paste image. Try again.");
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

    const isValidYoutubeUrl = (value: string) => {
      try {
        const url = new URL(value);
        const host = url.hostname.replace(/^www\./, "");
        if (host === "youtu.be") {
          const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
          return id.length >= 6;
        }
        if (host === "youtube.com" || host.endsWith(".youtube.com")) {
          if (url.pathname.startsWith("/watch")) {
            const id = url.searchParams.get("v") ?? "";
            return id.length >= 6;
          }
          if (url.pathname.startsWith("/shorts/")) {
            const id = url.pathname.split("/").filter(Boolean)[1] ?? "";
            return id.length >= 6;
          }
          if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/v/")) {
            const id = url.pathname.split("/").filter(Boolean)[1] ?? "";
            return id.length >= 6;
          }
          if (url.pathname.startsWith("/live/")) {
            const id = url.pathname.split("/").filter(Boolean)[1] ?? "";
            return id.length >= 6;
          }
        }
        return false;
      } catch {
        return false;
      }
    };
    const isValidYoutube = youtubeUrl.trim()
      ? isValidYoutubeUrl(youtubeUrl.trim())
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
      let imageOrientations: ("portrait" | "landscape")[] = [];
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
            return (await uploadResponse.json()) as {
              secure_url?: string;
              width?: number;
              height?: number;
            };
          })
        );
        const secureUrls = uploadResponses
          .map((res) => res?.secure_url)
          .filter((url): url is string => Boolean(url));
        if (secureUrls.length !== imageItems.length) {
          setSubmitError("Failed to upload images. Try again.");
          return;
        }
        const orientations = uploadResponses.map((res) => {
          if (!res?.width || !res?.height) return null;
          return res.height > res.width ? "portrait" : "landscape";
        });
        if (orientations.some((value) => !value)) {
          setSubmitError("Failed to read image orientation.");
          return;
        }
        imageUrls = secureUrls;
        imageOrientations = orientations as ("portrait" | "landscape")[];
      }

      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: mergedContent,
          images: imageUrls,
          imageOrientations,
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
      <MentionTextarea
        value={content}
        onChangeValue={setContent}
        placeholder={placeholder}
        className={`bg-transparent text-base text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full ${
          compact ? "min-h-[28px]" : "min-h-[36px]"
        }`}
        textareaRef={textAreaRef}
        readOnly={!isAuthenticated}
        ariaDisabled={!isAuthenticated}
        onClick={handleUnauthedTextClick}
        onFocus={handleUnauthedTextClick}
        onPaste={handlePasteImages}
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
          {imageItems.length}/4
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
