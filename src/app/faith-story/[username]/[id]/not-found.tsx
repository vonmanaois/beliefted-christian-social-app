"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Sidebar from "@/components/layout/Sidebar";
import PostBackHeader from "@/components/ui/PostBackHeader";

export default function FaithStoryNotFound() {
  const params = useParams<{ id?: string }>();
  const queryClient = useQueryClient();

  useEffect(() => {
    const rawId = params?.id;
    const storyId = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!storyId) return;
    queryClient.setQueriesData(
      { queryKey: ["faith-stories"] },
      (current: unknown) => {
        if (!Array.isArray(current)) return current;
        return current.filter((item) => {
          if (!item || typeof item !== "object") return true;
          const idValue = (item as { _id?: string })._id;
          return idValue !== storyId;
        });
      }
    );
    queryClient.invalidateQueries({ queryKey: ["faith-stories"] });
  }, [params?.id, queryClient]);

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div>
          <PostBackHeader label="Faith Story" refreshOnBack />
          <div className="panel p-6 sm:p-8 rounded-none">
            <h1 className="text-xl font-semibold text-[color:var(--ink)]">
              Story not available
            </h1>
            <p className="mt-2 text-sm text-[color:var(--subtle)]">
              Sorry for the inconvenience. This faith story may have been removed or
              the link might be outdated.
            </p>
            <p className="mt-4 text-sm text-[color:var(--subtle)]">
              Please try again later or return to the Faith Stories feed.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
