"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "@phosphor-icons/react";
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty = content.trim().length > 0 || scriptureRef.trim().length > 0;

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);

    if (!session?.user) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("open-signin"));
      }
      return;
    }

    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/words", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, scriptureRef }),
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
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowScriptureRef((prev) => !prev)}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            aria-label="Add scripture reference"
          >
            <Plus size={16} weight="regular" />
            Add verse reference
          </button>
          {showScriptureRef && (
            <input
              type="text"
              className="bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0"
              placeholder="Scripture reference"
              value={scriptureRef}
              onChange={(event) => setScriptureRef(event.target.value)}
            />
          )}
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
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
