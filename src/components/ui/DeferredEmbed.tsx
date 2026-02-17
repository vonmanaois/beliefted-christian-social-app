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
      const id = window.requestAnimationFrame(() => setIsActive(true));
      return () => cancelAnimationFrame(id);
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
