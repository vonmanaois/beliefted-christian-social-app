"use client";

import { useEffect, useRef, useState } from "react";

type DeferredEmbedProps = {
  title: string;
  className?: string;
  src?: string | null;
  allow?: string;
  height?: number | string;
  placeholder?: React.ReactNode;
};

export default function DeferredEmbed({
  title,
  className,
  src,
  allow,
  height,
  placeholder,
}: DeferredEmbedProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (isVisible) {
      const root = globalThis as typeof globalThis & {
        requestIdleCallback?: (cb: () => void) => number;
        cancelIdleCallback?: (id: number) => void;
        requestAnimationFrame?: (cb: () => void) => number;
        cancelAnimationFrame?: (id: number) => void;
      };
      if (typeof root.requestIdleCallback === "function") {
        const idleId = root.requestIdleCallback(() => setIsActive(true));
        return () => {
          if (idleId !== undefined) {
            root.cancelIdleCallback?.(idleId);
          }
        };
      }
      if (typeof root.requestAnimationFrame === "function") {
        const id = root.requestAnimationFrame(() => setIsActive(true));
        return () => root.cancelAnimationFrame?.(id);
      }
      const timeoutId = window.setTimeout(() => setIsActive(true), 0);
      return () => window.clearTimeout(timeoutId);
    }
    return;
  }, [isVisible]);

  return (
    <div ref={containerRef} className={className}>
      {isActive && src ? (
        <iframe
          title={title}
          src={src}
          loading="lazy"
          allow={allow}
          height={height}
          className="h-full w-full border-0"
        />
      ) : (
        placeholder ?? (
          <div className="h-full w-full animate-pulse rounded-2xl bg-[color:var(--panel)]" />
        )
      )}
    </div>
  );
}
