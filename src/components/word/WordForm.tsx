"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, YoutubeLogo, SpotifyLogo } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";

type WordFormProps = {
  onPosted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
  showHeader?: boolean;
  showScriptureToggle?: boolean;
  placeholder?: string;
};

export default function WordForm({
  onPosted,
  onDirtyChange,
  compact = false,
  flat = false,
  variant = "modal",
  showHeader = true,
  showScriptureToggle = false,
  placeholder = "What did God put on your heart today?",
}: WordFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [scriptureRef, setScriptureRef] = useState("");
  const [showScriptureRef, setShowScriptureRef] = useState(false);
  const [showYoutubeInput, setShowYoutubeInput] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState("");
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [showSpotifyInput, setShowSpotifyInput] = useState(false);
  const [spotifyUrl, setSpotifyUrl] = useState("");
  const [spotifyError, setSpotifyError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const linkPanelRef = useRef<HTMLDivElement | null>(null);
  const isDirty =
    content.trim().length > 0 ||
    scriptureRef.trim().length > 0 ||
    youtubeUrl.trim().length > 0 ||
    spotifyUrl.trim().length > 0;

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
    const handlePointer = (event: MouseEvent) => {
      if (!linkPanelRef.current) return;
      if (!linkPanelRef.current.contains(event.target as Node)) {
        if (!youtubeUrl.trim()) setShowYoutubeInput(false);
        if (!spotifyUrl.trim()) setShowSpotifyInput(false);
        if (!scriptureRef.trim()) setShowScriptureRef(false);
      }
    };
    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setYoutubeError(null);
    setSpotifyError(null);

    if (!session?.user) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("open-signin"));
      }
      return;
    }

    if (!content.trim() && !youtubeUrl.trim() && !spotifyUrl.trim()) return;

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
      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: mergedContent, scriptureRef }),
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
        onChange={(event) => {
          setContent(event.target.value);
          if (textAreaRef.current) {
            textAreaRef.current.style.height = "auto";
            textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
          }
        }}
      />

      {showScriptureToggle && (
        <div className="flex flex-col gap-2" ref={linkPanelRef}>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowScriptureRef((prev) => !prev)}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
              aria-label="Add scripture reference"
            >
              <Plus size={16} weight="regular" />
              Add verse reference
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
              disabled={Boolean(spotifyUrl.trim())}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Add YouTube link"
            >
              <YoutubeLogo size={16} weight="regular" />
              YouTube
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
              disabled={Boolean(youtubeUrl.trim())}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)] disabled:opacity-40 disabled:cursor-not-allowed"
              aria-label="Add Spotify link"
            >
              <SpotifyLogo size={16} weight="regular" />
              Spotify
            </button>
          </div>
          {showScriptureRef && (
            <input
              type="text"
              className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
              placeholder="Scripture reference"
              value={scriptureRef}
              onChange={(event) => setScriptureRef(event.target.value)}
            />
          )}
          {showYoutubeInput && (
            <input
              type="url"
              className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
              placeholder="Paste YouTube link"
              value={youtubeUrl}
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
              onChange={(event) => {
                setSpotifyUrl(event.target.value);
                if (spotifyError) setSpotifyError(null);
              }}
            />
          )}
          {spotifyError && (
            <p className="text-xs text-[color:var(--danger)]">{spotifyError}</p>
          )}
          {(youtubeUrl.trim() || spotifyUrl.trim()) && (
            <p className="text-[11px] text-[color:var(--subtle)]">
              Only one link is allowed per post.
            </p>
          )}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={
            isSubmitting ||
            (!content.trim() && !youtubeUrl.trim() && !spotifyUrl.trim())
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
