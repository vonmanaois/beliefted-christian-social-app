"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

type PostDetailOverlayProps = {
  children: React.ReactNode;
};

export default function PostDetailOverlay({ children }: PostDetailOverlayProps) {
  const router = useRouter();

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-[120] flex items-start justify-center bg-black/40 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={() => router.back()}
    >
      <div
        className="panel w-full max-w-3xl max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
