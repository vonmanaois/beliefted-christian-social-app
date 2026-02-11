"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/layout/Sidebar";

export default function HowToUseClient() {
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ target?: string }>).detail;
      if (detail?.target === "how") {
        setClosing(true);
      }
    };
    window.addEventListener("panel:close", handler);
    return () => window.removeEventListener("panel:close", handler);
  }, []);

  const panelState = closing
    ? "panel-slide-left-exit"
    : entered
      ? "panel-slide-left-entered"
      : "panel-slide-left-enter";

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className={`panel p-8 rounded-none panel-scroll-mobile ${panelState}`}>
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              How To Download
            </h1>
            <p className="mt-2 text-sm text-[color:var(--subtle)]">
              Add Beliefted to your home screen for fast access.
            </p>

            <div className="mt-8 space-y-6 text-sm text-[color:var(--ink)]">
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Add to Home Screen</h2>
                <p className="font-semibold">Safari (iOS)</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Beliefted in Safari.</li>
                  <li>Tap the Share icon.</li>
                  <li>Choose “Add to Home Screen”.</li>
                  <li>Confirm the name and tap Add.</li>
                </ol>
                <p className="font-semibold mt-4">Android (Chrome)</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Open Beliefted in Chrome.</li>
                  <li>Tap the menu (three dots).</li>
                  <li>Select “Add to Home screen” or “Install app”.</li>
                  <li>Confirm to add it to your device.</li>
                </ol>
              </section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
