"use client";

import { useEffect, useRef, useState } from "react";

type LazyEmbedProps = {
  children: React.ReactNode;
  className?: string;
  rootMargin?: string;
};

export default function LazyEmbed({ children, className, rootMargin = "200px" }: LazyEmbedProps) {
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={containerRef} className={className}>
      {visible ? children : null}
    </div>
  );
}
