"use client";

import { useEffect, useRef, useState } from "react";
import { PlusCircle } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";

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
  const [kind, setKind] = useState<"prayer" | "request">("prayer");
  const [content, setContent] = useState("");
  const [points, setPoints] = useState<
    { title: string; description: string }[]
  >([{ title: "", description: "" }]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<7 | 30 | "never">(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (variant !== "modal") return;
    const id = setTimeout(() => {
      textAreaRef.current?.focus();
    }, 0);
    return () => clearTimeout(id);
  }, [variant]);

  const hasValidRequestPoints =
    points.filter((point) => point.title.trim() && point.description.trim())
      .length > 0;

  const canSubmit =
    kind === "prayer" ? content.trim().length > 0 : hasValidRequestPoints;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!session?.user) {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("open-signin"));
      }
      return;
    }

    if (!canSubmit) return;

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/prayers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          content,
          prayerPoints:
            kind === "request"
              ? points
                  .map((p) => ({
                    title: p.title.trim(),
                    description: p.description.trim(),
                  }))
                  .filter((p) => p.title && p.description)
                  .slice(0, 8)
              : [],
          isAnonymous,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to post prayer");
      }

      setKind("prayer");
      setContent("");
      setPoints([{ title: "", description: "" }]);
      setIsAnonymous(false);
      setExpiresInDays(7);
      onPosted?.();
      if (typeof window !== "undefined") {
        window.dispatchEvent(new Event("feed:refresh"));
      }
      if (typeof window !== "undefined") {
        void fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ event: "prayer_posted" }),
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
      id="prayer-form"
      onSubmit={handleSubmit}
      className={`${
        variant === "modal" ? "modal-form" : flat ? "feed-form" : "panel-glass"
      } flex flex-col gap-3 scroll-mt-24 ${
        compact ? "p-3" : "p-4"
      }`}
    >
      <div className="flex items-center gap-3 text-sm text-[color:var(--subtle)]">
        <span>Type</span>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="kind"
            checked={kind === "prayer"}
            onChange={() => setKind("prayer")}
          />
          Prayer
        </label>
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="kind"
            checked={kind === "request"}
            onChange={() => setKind("request")}
          />
          Prayer Request
        </label>
      </div>

      {kind === "prayer" ? (
        <textarea
          className={`soft-input modal-input text-sm ${compact ? "min-h-[90px]" : "min-h-[110px]"}`}
          placeholder="Write your prayer..."
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
      ) : (
        <div className="flex flex-col gap-3">
          {points.map((point, index) => (
            <div key={index} className="flex flex-col gap-2">
              <input
                className="soft-input modal-input text-sm"
                placeholder="Prayer point (title)"
                value={point.title}
                onChange={(event) => {
                  const next = [...points];
                  next[index] = { ...next[index], title: event.target.value };
                  setPoints(next);
                }}
              />
              <textarea
                className="soft-input modal-input text-sm min-h-[80px]"
                placeholder="Prayer description..."
                value={point.description}
                onChange={(event) => {
                  const next = [...points];
                  next[index] = { ...next[index], description: event.target.value };
                  setPoints(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setPoints((prev) => [...prev, { title: "", description: "" }])
            }
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            <PlusCircle size={16} weight="regular" />
            Add prayer point
          </button>
        </div>
      )}

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
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="expires"
              checked={expiresInDays === "never"}
              onChange={() => setExpiresInDays("never")}
            />
            Never
          </label>
        </div>
        <p className="text-xs text-[color:var(--subtle)]">
          Expired prayers are removed and no longer viewable.
        </p>
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !canSubmit}
          className="post-button disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : "Pray"}
        </button>
      </div>
    </form>
  );
}
