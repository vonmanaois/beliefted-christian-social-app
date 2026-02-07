"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";

type WordFormProps = {
  onPosted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
};

export default function WordForm({
  onPosted,
  onDirtyChange,
  compact = false,
  flat = false,
  variant = "modal",
}: WordFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty = content.trim().length > 0;

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
        body: JSON.stringify({ content }),
      });

      if (!response.ok) {
        throw new Error("Failed to post word");
      }

      setContent("");
      onPosted?.();
      onDirtyChange?.(false);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("feed:refresh"));
      }
      if (typeof window !== "undefined") {
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "word_posted" }),
        });
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
      } flex flex-col gap-3 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {!compact && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
            Faith Share
          </p>
        </div>
      )}

      <textarea
        className={`soft-input modal-input text-sm ${compact ? "min-h-[90px]" : "min-h-[110px]"}`}
        placeholder="Share a verse or reflection..."
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

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !content.trim()}
          className="post-button disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : !content.trim() ? "⊘ Post" : "Post"}
        </button>
      </div>
    </form>
  );
}
