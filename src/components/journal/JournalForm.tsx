"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import FaithStoryEditor from "@/components/faith/FaithStoryEditor";
import { stripHtmlToText } from "@/lib/mentions";

type JournalFormProps = {
  initialTitle?: string;
  initialContent?: string;
  onSubmit: (title: string, content: string) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function JournalForm({
  initialTitle = "",
  initialContent = "",
  onSubmit,
  onCancel,
  submitLabel = "Save",
  onDirtyChange,
}: JournalFormProps) {
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user?.id);
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDirty =
    title.trim() !== initialTitle.trim() ||
    content.trim() !== initialContent.trim();

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
    setError(null);
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    const textContent = stripHtmlToText(content);
    if (!title.trim() || !textContent) {
      setError("Title and text are required.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(title.trim(), content.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        className="bg-transparent text-lg font-semibold text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-2 focus:outline-none focus:ring-0 focus:border-[color:var(--panel-border)]"
        placeholder="Title"
        value={title}
        readOnly={!isAuthenticated}
        aria-disabled={!isAuthenticated}
        onClick={handleUnauthedTextClick}
        onFocus={handleUnauthedTextClick}
        onChange={(event) => setTitle(event.target.value)}
      />
      <div
        onMouseDown={() => {
          if (!isAuthenticated) openSignIn();
        }}
        onTouchStart={() => {
          if (!isAuthenticated) openSignIn();
        }}
      >
        <FaithStoryEditor
          value={content}
          onChange={setContent}
          placeholder="What does God tell you today..."
          disabled={!isAuthenticated}
          allowImages={false}
        />
      </div>
      {error && <p className="text-xs text-[color:var(--danger)]">{error}</p>}
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-2 text-xs font-semibold text-[color:var(--ink)] cursor-pointer hover:text-[color:var(--accent)]"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={!isAuthenticated || isSaving}
          className="post-button disabled:opacity-60"
        >
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
