"use client";

import { useEffect, useRef, useState } from "react";

type FaithStoryFormProps = {
  initialTitle?: string;
  initialContent?: string;
  initialAnonymous?: boolean;
  onSubmit: (title: string, content: string, isAnonymous: boolean) => Promise<void> | void;
  onCancel?: () => void;
  submitLabel?: string;
  onDirtyChange?: (dirty: boolean) => void;
};

export default function FaithStoryForm({
  initialTitle = "",
  initialContent = "",
  initialAnonymous = false,
  onSubmit,
  onCancel,
  submitLabel = "Publish",
  onDirtyChange,
}: FaithStoryFormProps) {
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isAnonymous, setIsAnonymous] = useState(initialAnonymous);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty =
    title.trim() !== initialTitle.trim() ||
    content.trim() !== initialContent.trim() ||
    isAnonymous !== initialAnonymous;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const maxHeight = Math.max(260, Math.floor(window.innerHeight * 0.6));
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !content.trim()) {
      setError("Title and story are required.");
      return;
    }
    setIsSaving(true);
    try {
      await onSubmit(title.trim(), content.trim(), isAnonymous);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        className="bg-transparent text-2xl font-semibold text-[color:var(--ink)] outline-none border-b border-[color:var(--panel-border)] pb-3 focus:outline-none focus:ring-0 focus:border-[color:var(--panel-border)] text-center"
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        ref={textRef}
        className="bg-transparent text-sm text-[color:var(--ink)] outline-none min-h-[240px] resize-none focus:outline-none focus:ring-0 overflow-hidden"
        placeholder="Share your faith story..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
      {error && <p className="text-xs text-[color:var(--danger)]">{error}</p>}
      <label className="inline-flex items-center gap-2 text-xs font-semibold text-[color:var(--subtle)] cursor-pointer">
        <input
          type="checkbox"
          checked={isAnonymous}
          onChange={(event) => setIsAnonymous(event.target.checked)}
          className="h-4 w-4"
        />
        Post anonymously
      </label>
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
          disabled={isSaving}
          className="post-button disabled:opacity-60"
        >
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
