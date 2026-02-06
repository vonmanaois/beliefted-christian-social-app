"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";

type PostFormProps = {
  onPosted?: () => void;
  compact?: boolean;
  flat?: boolean;
};

export default function PostForm({
  onPosted,
  compact = false,
  flat = false,
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
      className={`${flat ? "feed-form" : "panel-glass"} flex flex-col gap-3 scroll-mt-24 ${
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
        className={`soft-input text-sm ${compact ? "min-h-[90px]" : "min-h-[110px]"}`}
        placeholder="Write your prayer..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <label className="inline-flex items-center gap-2">
          <input
            type="checkbox"
            checked={isAnonymous}
            onChange={(event) => setIsAnonymous(event.target.checked)}
          />
          Post anonymously
        </label>

        <div className="flex items-center gap-2">
          <span className="text-[color:var(--subtle)]">Expires</span>
          <select
            className="soft-input"
            value={expiresInDays}
            onChange={(event) =>
              setExpiresInDays(event.target.value === "30" ? 30 : 7)
            }
          >
            <option value={7}>7 days</option>
            <option value={30}>30 days</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting}
          className="pill-button bg-[color:var(--accent)] text-white disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : "Post Prayer"}
        </button>
      </div>
    </form>
  );
}
