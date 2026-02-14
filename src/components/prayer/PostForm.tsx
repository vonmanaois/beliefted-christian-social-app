"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, LockSimple, MinusCircle, PlusCircle, UsersThree } from "@phosphor-icons/react";
import { useSession } from "next-auth/react";
import { useUIStore } from "@/lib/uiStore";
import MentionTextarea from "@/components/ui/MentionTextarea";

type PostFormProps = {
  onPosted?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  compact?: boolean;
  flat?: boolean;
  variant?: "modal" | "inline";
};

export default function PostForm({
  onPosted,
  onDirtyChange,
  compact = false,
  flat = false,
  variant = "modal",
}: PostFormProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const { setNewPrayerPosts } = useUIStore();
  const [kind, setKind] = useState<"prayer" | "request">("prayer");
  const [content, setContent] = useState("");
  const [points, setPoints] = useState<
    { title: string; description: string }[]
  >([{ title: "", description: "" }]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [privacy, setPrivacy] = useState<"public" | "followers" | "private">("public");
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<7 | 30 | "never">(7);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);
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
    isAuthenticated &&
    (kind === "prayer" ? content.trim().length > 0 : hasValidRequestPoints);

  const isDirty =
    kind === "prayer"
      ? content.trim().length > 0
      : points.some(
          (point) => point.title.trim().length > 0 || point.description.trim().length > 0
        ) || privacy !== "public";

  const showRequestValidation =
    kind === "request" &&
    Boolean(validationError?.toLowerCase().includes("prayer point"));

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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setValidationError(null);

    if (!session?.user) {
      openSignIn();
      return;
    }

    if (!canSubmit) {
      setValidationError(
        kind === "prayer"
          ? "Write a prayer before posting."
          : "Add at least one prayer point with a title and description."
      );
      return;
    }

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
          privacy,
          expiresInDays,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setValidationError(payload?.error ?? "Failed to post prayer.");
        return;
      }

      setKind("prayer");
      setContent("");
      setPoints([{ title: "", description: "" }]);
      setIsAnonymous(false);
      setPrivacy("public");
      setShowPrivacyMenu(false);
      setExpiresInDays(7);
      setValidationError(null);
      setNewPrayerPosts(false);
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
      id="prayer-form"
      onSubmit={handleSubmit}
      ref={formRef}
      onFocusCapture={() => setShowExtras(true)}
      onBlurCapture={() => {
        if (kind !== "prayer") return;
        setTimeout(() => {
          const active = document.activeElement;
          if (formRef.current?.contains(active)) return;
          if (isDirty) return;
          setShowExtras(false);
        }, 0);
      }}
      className={`${
        variant === "modal" ? "modal-form" : flat ? "feed-form" : "panel-glass"
      } flex flex-col gap-2 scroll-mt-24 w-full ${
        compact ? "p-3" : "p-4"
      } pb-0`}
    >
      {kind === "prayer" ? (
        <MentionTextarea
          value={content}
          onChangeValue={setContent}
          placeholder="What can we pray for today?"
          className={`bg-transparent text-base text-[color:var(--ink)] outline-none focus:outline-none focus:ring-0 resize-none w-full ${
            compact ? "min-h-[28px]" : "min-h-[36px]"
          }`}
          textareaRef={textAreaRef}
          readOnly={!isAuthenticated}
          ariaDisabled={!isAuthenticated}
          onClick={handleUnauthedTextClick}
          onFocus={handleUnauthedTextClick}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[color:var(--ink)]">
              Prayer request
            </span>
            <button
              type="button"
              onClick={() => setKind("prayer")}
              className="text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            >
              Back to prayer
            </button>
          </div>
          {points.map((point, index) => (
            <div key={index} className="flex flex-col gap-2">
              <input
                className={`bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0 ${
                  showRequestValidation && !point.title.trim()
                    ? "border-[color:var(--danger)]"
                    : ""
                }`}
                placeholder="Prayer point"
                value={point.title}
                readOnly={!isAuthenticated}
                aria-disabled={!isAuthenticated}
                onClick={handleUnauthedTextClick}
                onFocus={handleUnauthedTextClick}
                onChange={(event) => {
                  const next = [...points];
                  next[index] = { ...next[index], title: event.target.value };
                  setPoints(next);
                }}
              />
              <MentionTextarea
                value={point.description}
                onChangeValue={(nextValue) => {
                  const next = [...points];
                  next[index] = { ...next[index], description: nextValue };
                  setPoints(next);
                }}
                placeholder="Description"
                className={`bg-transparent text-sm text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-1 focus:outline-none focus:ring-0 resize-none min-h-[60px] w-full ${
                  showRequestValidation && !point.description.trim()
                    ? "border-[color:var(--danger)]"
                    : ""
                }`}
                readOnly={!isAuthenticated}
                ariaDisabled={!isAuthenticated}
                onClick={handleUnauthedTextClick}
                onFocus={handleUnauthedTextClick}
              />
              {points.length > 1 && index === points.length - 1 && (
                <button
                  type="button"
                  onClick={() =>
                    setPoints((prev) => prev.filter((_, i) => i !== index))
                  }
                  disabled={!isAuthenticated}
                  className="self-start text-[color:var(--danger)] hover:text-[color:var(--danger-strong)]"
                  aria-label="Remove prayer point"
                >
                  <MinusCircle size={16} weight="bold" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() =>
              setPoints((prev) => [...prev, { title: "", description: "" }])
            }
            disabled={!isAuthenticated}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent-strong)]"
          >
            <PlusCircle size={16} weight="regular" />
            Add prayer point
          </button>
        </div>
      )}

      {(showExtras || kind === "request") && (
        <div className="mt-2 flex flex-wrap items-center gap-3 w-full text-xs text-[color:var(--subtle)] relative">
          {kind === "prayer" && (
            <button
              type="button"
              onClick={() => setKind("request")}
              disabled={!isAuthenticated}
              className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            >
              <PlusCircle size={16} weight="regular" />
              Add prayer request
            </button>
          )}
          <label className="inline-flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAnonymous}
              disabled={!isAuthenticated}
              onChange={(event) => setIsAnonymous(event.target.checked)}
            />
            Anonymous
          </label>

          <div className="flex items-center gap-3 flex-wrap">
            <span>Expires</span>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="expires"
                checked={expiresInDays === 7}
                disabled={!isAuthenticated}
                onChange={() => setExpiresInDays(7)}
              />
              7d
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="expires"
                checked={expiresInDays === 30}
                disabled={!isAuthenticated}
                onChange={() => setExpiresInDays(30)}
              />
              30d
            </label>
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="expires"
                checked={expiresInDays === "never"}
                disabled={!isAuthenticated}
                onChange={() => setExpiresInDays("never")}
              />
              Never
            </label>
          </div>
          <button
            type="button"
            onClick={() => setShowPrivacyMenu((prev) => !prev)}
            disabled={!isAuthenticated}
            className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] hover:text-[color:var(--ink)]"
            aria-label="Prayer privacy"
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
            <div className="absolute left-0 top-9 z-10 min-w-[180px] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--menu)] p-2 shadow-lg">
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
      )}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!isAuthenticated || isSubmitting || !canSubmit}
          className="post-button disabled:opacity-60"
        >
          {isSubmitting ? "Posting..." : "Pray"}
        </button>
      </div>
      {validationError && (
        <p className="text-xs text-[color:var(--danger)]">{validationError}</p>
      )}
    </form>
  );
}
