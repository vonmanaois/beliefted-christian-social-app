"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type PostFormProps = {
  onPosted?: () => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
};

export default function PostForm({
  onPosted,
  compact = false,
  flat = false,
  variant = "modal",
}: PostFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<7 | 30>(7);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user) {
      signIn("google");
      return;
    }

    if (!content.trim()) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/prayers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isAnonymous, expiresInDays }),
      });

      if (!response.ok) {
        throw new Error("Failed to post prayer");
      }

      setContent("");
      setIsAnonymous(false);
      setExpiresInDays(7);
      onPosted?.();
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form
      id="prayer-form"
      onSubmit={handleSubmit}
      className={`${
        variant === "modal" ? "modal-form" : flat ? "feed-form" : "panel-glass"
      } flex flex-col gap-3 scroll-mt-24 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      {!compact && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--subtle)]">
            Prayer
          </p>
        </div>
      )}

      <textarea
        className={`soft-input modal-input text-sm ${compact ? "min-h-[90px]" : "min-h-[110px]"}`}
        placeholder="Write your prayer..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
        <label className="switch-toggle text-[color:var(--subtle)]">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(event) => setIsAnonymous(event.target.checked)}
          />
          <span className="switch-track">
            <span className="switch-thumb" />
          </span>
          Anonymous
        </label>

        <div className="flex items-center gap-3 text-[color:var(--subtle)]">
          <span>Expires</span>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="expires"
              checked={expiresInDays === 7}
              onChange={() => setExpiresInDays(7)}
            />
            7d
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="expires"
              checked={expiresInDays === 30}
              onChange={() => setExpiresInDays(30)}
            />
            30d
          </label>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="post-button disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : "Post"}
        </button>
      </div>
    </form>
  );
}
