"use client";

import Link from "next/link";
import { useMemo } from "react";

type MentionTextProps = {
  text: string;
  className?: string;
};

const isWordChar = (value: string) => /[A-Za-z0-9_]/.test(value);
const mentionRegex = /@([a-zA-Z0-9_.]{1,30})/g;

export default function MentionText({ text, className }: MentionTextProps) {
  const parts = useMemo(() => {
    if (!text) return [""];
    const nodes: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    const regex = new RegExp(mentionRegex);
    while ((match = regex.exec(text)) !== null) {
      const start = match.index;
      const before = start > 0 ? text[start - 1] : "";
      if (before && isWordChar(before)) {
        continue;
      }
      const username = match[1];
      const end = start + match[0].length;
      if (start > lastIndex) {
        nodes.push(text.slice(lastIndex, start));
      }
      nodes.push(
        <Link key={`${username}-${start}`} href={`/profile/${username}`} prefetch={false}>
          <span className="mention-link">@{username}</span>
        </Link>
      );
      lastIndex = end;
    }
    if (lastIndex < text.length) {
      nodes.push(text.slice(lastIndex));
    }
    return nodes;
  }, [text]);

  return <span className={className}>{parts}</span>;
}
