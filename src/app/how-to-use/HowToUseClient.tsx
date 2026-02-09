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
    ? "panel-slide-right-exit"
    : entered
      ? "panel-slide-right-entered"
      : "panel-slide-right-enter";

  return (
    <main className="container">
      <div className="page-grid">
        <Sidebar />
        <div className={`panel p-8 rounded-none panel-scroll-mobile ${panelState}`}>
          <div className="max-w-3xl">
            <h1 className="text-2xl font-semibold text-[color:var(--ink)]">
              How To Use Beliefted
            </h1>
            <p className="mt-2 text-sm text-[color:var(--subtle)]">
              A quick guide to help you get the most out of your faith community.
            </p>

            <div className="mt-8 space-y-6 text-sm text-[color:var(--ink)]">
              <section className="space-y-2">
                <h2 className="text-base font-semibold">Getting Started</h2>
                <p>
                  Sign in with Google, complete your profile, and start exploring
                  the Home feed. You can switch between prayers and words from the
                  tabs on the Home page.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-semibold">Faith Story</h2>
                <p>
                  Faith Stories are public, shareable posts. Add a title and your
                  story, then share the link with others. You can also toggle
                  anonymous posting if you want to keep your name private.
                </p>
                <p>
                  Stories can be searched by title or name from the Faith Stories
                  page.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-semibold">Journal</h2>
                <p>
                  The Journal is private and only visible to you. It works like a
                  personal journal where you can write a title and reflection. Entries
                  are grouped by month and year, with a Today section when you have a
                  current entry.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-semibold">Prayer & Word</h2>
                <p>
                  Share a prayer or a word of encouragement, and respond to others
                  through comments and reactions. This is where the community comes
                  together and lifts each other in faith.
                </p>
              </section>

              <section className="space-y-2">
                <h2 className="text-base font-semibold">Notifications</h2>
                <p>
                  Stay updated on prayers, comments, and faith story activity. Tap
                  a notification to jump directly to the post or profile.
                </p>
              </section>

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
