"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";

type PostBackHeaderProps = {
  label: string;
  refreshOnBack?: boolean;
};

export default function PostBackHeader({ label, refreshOnBack }: PostBackHeaderProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return (
    <div className="mb-3 flex items-center justify-between px-2">
      <button
        type="button"
        onClick={() => {
          if (refreshOnBack) {
            queryClient.invalidateQueries({ queryKey: ["words"] });
            queryClient.invalidateQueries({ queryKey: ["prayers"] });
            queryClient.invalidateQueries({ queryKey: ["following-feed"] });
            queryClient.invalidateQueries({ queryKey: ["faith-stories"] });
          }
          router.back();
          if (refreshOnBack && typeof window !== "undefined") {
            window.setTimeout(() => {
              window.dispatchEvent(new Event("feed:refresh"));
            }, 200);
          }
        }}
        className="inline-flex items-center justify-center h-11 w-11 rounded-full text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        aria-label="Back"
      >
        <span className="text-xl font-semibold">⟵</span>
      </button>
      <span className="text-sm font-semibold text-[color:var(--ink)]">
        {label}
      </span>
      <span className="h-11 w-11" aria-hidden="true" />
    </div>
  );
}
