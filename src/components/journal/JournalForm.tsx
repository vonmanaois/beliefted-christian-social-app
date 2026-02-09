"use client";

import { useEffect, useRef, useState } from "react";

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
  const [title, setTitle] = useState(initialTitle);
  const [content, setContent] = useState(initialContent);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const isDirty =
    title.trim() !== initialTitle.trim() || content.trim() !== initialContent.trim();

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const maxHeight = Math.max(240, Math.floor(window.innerHeight * 0.6));
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [content]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!title.trim() || !content.trim()) {
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
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        ref={textRef}
        className="bg-transparent text-sm text-[color:var(--ink)] outline-none min-h-[220px] resize-none focus:outline-none focus:ring-0 overflow-hidden"
        placeholder="What does God telling you today..."
        value={content}
        onChange={(event) => setContent(event.target.value)}
      />
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
          disabled={isSaving}
          className="post-button disabled:opacity-60"
        >
          {isSaving ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
  );
}
