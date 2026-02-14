"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import Image from "next/image";
import { cloudinaryTransform } from "@/lib/cloudinary";

type MentionUser = {
  id?: string | null;
  username?: string | null;
  name?: string | null;
  image?: string | null;
};

type MentionTextareaProps = {
  value: string;
  onChangeValue: (next: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  readOnly?: boolean;
  ariaDisabled?: boolean;
  autoResize?: boolean;
  minHeight?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onFocus?: () => void;
  onClick?: () => void;
  onPaste?: (event: React.ClipboardEvent<HTMLTextAreaElement>) => void;
};

const mentionRegex = /@([a-zA-Z0-9_.]{0,30})/g;
const isWordChar = (value: string) => /[A-Za-z0-9_]/.test(value);

const getMentionMatch = (value: string, cursor: number) => {
  const upto = value.slice(0, cursor);
  let match: RegExpExecArray | null;
  let lastMatch: RegExpExecArray | null = null;
  mentionRegex.lastIndex = 0;
  while ((match = mentionRegex.exec(upto)) !== null) {
    lastMatch = match;
  }
  if (!lastMatch) return null;
  const start = lastMatch.index;
  const before = start > 0 ? upto[start - 1] : "";
  if (before && isWordChar(before)) return null;
  const end = start + lastMatch[0].length;
  if (end !== cursor) return null;
  const lastChar = upto[cursor - 1] ?? "";
  if (lastChar && !isWordChar(lastChar)) return null;
  const query = lastMatch[1] ?? "";
  return { query, start, end: cursor };
};

export default function MentionTextarea({
  value,
  onChangeValue,
  placeholder,
  className,
  disabled,
  readOnly,
  ariaDisabled,
  autoResize = true,
  minHeight,
  textareaRef,
  onFocus,
  onClick,
  onPaste,
}: MentionTextareaProps) {
  const innerRef = useRef<HTMLTextAreaElement | null>(null);
  const ref = textareaRef ?? innerRef;
  const [suggestions, setSuggestions] = useState<MentionUser[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<{ start: number; end: number } | null>(null);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<number | null>(null);

  const shouldShow = open && suggestions.length > 0;

  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(async () => {
      if (query.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const data = (await response.json()) as MentionUser[];
        setSuggestions(data.slice(0, 5));
        setActiveIndex(0);
      } catch {
        setSuggestions([]);
      }
    }, 200);

    return () => {
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [query, open]);

  const handleChange = (next: string) => {
    onChangeValue(next);
    if (!ref.current) return;
    if (autoResize) {
      ref.current.style.height = "auto";
      ref.current.style.height = `${ref.current.scrollHeight}px`;
    }
    const cursor = ref.current.selectionStart ?? next.length;
    const match = getMentionMatch(next, cursor);
    if (!match) {
      setOpen(false);
      setQuery("");
      setRange(null);
      return;
    }
    setOpen(true);
    setQuery(match.query);
    setRange({ start: match.start, end: match.end });
  };

  const selectUser = (user: MentionUser) => {
    if (!user.username || !range) return;
    const before = value.slice(0, range.start);
    const after = value.slice(range.end);
    const nextValue = `${before}@${user.username} ${after}`;
    onChangeValue(nextValue);
    setOpen(false);
    setQuery("");
    setRange(null);
    requestAnimationFrame(() => {
      if (!ref.current) return;
      const usernameLength = user.username?.length ?? 0;
      const cursor = before.length + usernameLength + 2;
      ref.current.focus();
      ref.current.setSelectionRange(cursor, cursor);
      if (autoResize) {
        ref.current.style.height = "auto";
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!shouldShow) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((prev) => (prev + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      selectUser(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  const list = suggestions.map((user, index) => (
    <button
      key={`${user.username ?? "user"}-${index}`}
      type="button"
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => selectUser(user)}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-xs ${
        index === activeIndex
          ? "bg-[color:var(--surface-strong)]"
          : "bg-transparent"
      }`}
    >
      <span className="h-6 w-6 rounded-full overflow-hidden bg-[color:var(--surface-strong)] flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
        {user.image ? (
          <Image
            src={cloudinaryTransform(user.image, { width: 48, height: 48 })}
            alt=""
            width={24}
            height={24}
            sizes="24px"
            className="h-full w-full object-cover"
          />
        ) : (
          (user.name?.[0] ?? "U").toUpperCase()
        )}
      </span>
      <div className="flex flex-col">
        <span className="font-semibold text-[color:var(--ink)]">
          {user.name ?? user.username ?? "User"}
        </span>
        {user.username && (
          <span className="text-[10px] text-[color:var(--subtle)]">@{user.username}</span>
        )}
      </div>
    </button>
  ));

  return (
    <div className="relative">
      <textarea
        ref={ref}
        className={className}
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        readOnly={readOnly}
        aria-disabled={ariaDisabled}
        onClick={onClick}
        onFocus={onFocus}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onPaste={onPaste}
        onBlur={() => {
          window.setTimeout(() => {
            setOpen(false);
          }, 120);
        }}
        style={minHeight ? { minHeight } : undefined}
      />
      {shouldShow && (
        <div className="mention-suggestions absolute left-0 top-full z-20 mt-2 w-full overflow-hidden rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] shadow-lg">
          {list}
        </div>
      )}
    </div>
  );
}
