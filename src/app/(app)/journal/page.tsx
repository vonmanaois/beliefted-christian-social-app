"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import JournalBoard from "@/components/journal/JournalBoard";
import PanelMotion from "@/components/layout/PanelMotion";

function JournalShell() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-7 w-36 rounded-lg bg-[color:var(--surface-strong)]" />
      <div className="h-4 w-48 rounded-lg bg-[color:var(--surface-strong)]" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
        <div className="h-[180px] rounded-2xl bg-[color:var(--surface-strong)]" />
      </div>
    </div>
  );
}

export default function JournalPage() {
  const router = useRouter();
  const { status } = useSession();
  const hasRedirected = useRef(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (hasRedirected.current) return;
    if (status === "unauthenticated") {
      hasRedirected.current = true;
      router.replace("/");
    }
  }, [router, status]);

  const panelState = entered ? "panel-slide-up-entered" : "panel-slide-up-enter";

  return (
    <PanelMotion className={`panel p-6 sm:p-8 rounded-none ${panelState}`} motion="none">
      {status === "authenticated" ? <JournalBoard /> : <JournalShell />}
    </PanelMotion>
  );
}
