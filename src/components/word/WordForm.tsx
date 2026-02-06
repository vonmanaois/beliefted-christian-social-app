"use client";

import { useState } from "react";
import { signIn, useSession } from "next-auth/react";

type WordFormProps = {
  onPosted?: () => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
};

export default function WordForm({
  onPosted,
  compact = false,
  flat = false,
  variant = "modal",
}: WordFormProps) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
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
            Word of the Day
          </p>
        </div>
      )}

      <textarea
        className={`soft-input modal-input text-sm ${compact ? "min-h-[90px]" : "min-h-[110px]"}`}
        placeholder="Share a verse or reflection..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

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
