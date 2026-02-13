"use client";

import { useQuery } from "@tanstack/react-query";

export const useAdmin = () =>
  useQuery({
    queryKey: ["admin-check"],
    queryFn: async () => {
      const response = await fetch("/api/admin/check", { cache: "no-store" });
      if (!response.ok) return { isAdmin: false };
      return (await response.json()) as { isAdmin: boolean };
    },
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
