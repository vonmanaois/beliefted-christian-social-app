"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import PanelMotion from "@/components/layout/PanelMotion";

export default function ProfilePage() {
  const router = useRouter();
  const { status } = useSession();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (status === "unauthenticated") {
      hasRedirected.current = true;
      router.replace("/");
      return;
    }
    if (status !== "authenticated") return;

    const run = async () => {
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (!response.ok) {
          hasRedirected.current = true;
          router.replace("/");
          return;
        }
        const data = (await response.json()) as {
          username?: string | null;
          onboardingComplete?: boolean;
        };
        hasRedirected.current = true;
        if (data?.onboardingComplete && data?.username) {
          router.replace(`/profile/${data.username}`);
        } else {
          router.replace("/onboarding");
        }
      } catch {
        hasRedirected.current = true;
        router.replace("/");
      }
    };

    void run();
  }, [router, status]);

  return (
    <PanelMotion className="panel rounded-none p-4 sm:p-8" motion="none">
      <div className="animate-pulse space-y-4">
        <div className="h-6 w-40 rounded-lg bg-[color:var(--surface-strong)]" />
        <div className="h-4 w-28 rounded-lg bg-[color:var(--surface-strong)]" />
        <div className="h-20 w-full rounded-xl bg-[color:var(--surface-strong)]" />
      </div>
    </PanelMotion>
  );
}
