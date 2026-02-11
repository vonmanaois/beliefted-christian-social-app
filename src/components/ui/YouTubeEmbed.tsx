"use client";

import { useEffect, useRef } from "react";

const buildYouTubeSrc = (videoId: string) => {
  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    modestbranding: "1",
  });
  if (typeof window !== "undefined") {
    params.set("origin", window.location.origin);
  }
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

type YouTubeEmbedProps = {
  videoId: string;
  className?: string;
  title?: string;
};

export default function YouTubeEmbed({ videoId, className, title }: YouTubeEmbedProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const src = buildYouTubeSrc(videoId);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) {
            frame.contentWindow?.postMessage(
              JSON.stringify({ event: "command", func: "pauseVideo", args: [] }),
              "*"
            );
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <iframe
      ref={frameRef}
      src={src}
      title={title ?? "YouTube video"}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowFullScreen
      className={className}
    />
  );
}
