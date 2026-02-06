"use client";

import { useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Modal from "@/components/layout/Modal";
import ThemeToggle from "@/components/layout/ThemeToggle";

export default function Sidebar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showThemes, setShowThemes] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const router = useRouter();

  type NotificationActor = { name?: string | null; image?: string | null };
  type NotificationItem = {
    _id: string;
    type: "pray" | "comment" | "word_like" | "word_comment";
    createdAt: string;
    actorId?: NotificationActor | null;
    prayerId?: { content?: string } | null;
    wordId?: { content?: string } | null;
  };

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const openNotifications = async () => {
    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }

    setShowNotifications(true);
    setIsLoadingNotifications(true);

    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      const data = (await response.json()) as NotificationItem[];
      setNotifications(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  return (
    <aside className="panel p-5 flex flex-col gap-5 h-fit">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-3 text-left cursor-pointer"
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2d6cdf] to-[#9b6cff]" />
        <div>
          <p className="text-sm font-semibold text-[color:var(--ink)]">Lifted</p>
          <p className="text-xs text-[color:var(--subtle)]">Prayer Wall</p>
        </div>
      </button>

      <div className="flex flex-col gap-3 text-base text-[color:var(--ink)]">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => router.push("/")}
        >
          <span className="h-10 w-10 rounded-2xl border border-slate-200 bg-[color:var(--panel)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8Z" />
            </svg>
          </span>
          Home
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => {
            if (isAuthenticated) {
              router.push("/profile");
            } else {
              setShowSignIn(true);
            }
          }}
        >
          <span className="h-10 w-10 rounded-2xl border border-slate-200 bg-[color:var(--panel)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M20 20a8 8 0 1 0-16 0" />
              <circle cx="12" cy="9" r="3.5" />
            </svg>
          </span>
          Profile
        </button>
        <a
          href="#prayer-form"
          className="flex items-center gap-3 cursor-pointer"
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--accent)] text-white flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </span>
          Post a Prayer
        </a>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer"
          aria-label="Notifications"
          onClick={openNotifications}
        >
          <span className="h-10 w-10 rounded-2xl border border-slate-200 bg-[color:var(--panel)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M9 3v7M15 3v7" />
              <path d="M9 9h6" />
              <path d="M7 12c.6 1.2 2.4 2 5 2s4.4-.8 5-2" />
              <path d="M6 16h12" />
              <path d="M10 16v3M14 16v3" />
            </svg>
          </span>
          Notifications
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => setShowThemes((prev) => !prev)}
        >
          <span className="h-10 w-10 rounded-2xl border border-slate-200 bg-[color:var(--panel)] flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M4 7h16M4 12h16M4 17h16" />
            </svg>
          </span>
          Preferences
        </button>
      </div>

      <div
        className={`overflow-hidden transition-all duration-300 ${
          showThemes ? "max-h-[520px] opacity-100 mt-2" : "max-h-0 opacity-0"
        }`}
      >
        <div className="panel p-4 flex flex-col gap-4 ml-6">
          <ThemeToggle />
          <div className="mt-2 border-t border-slate-200 pt-4">
            {isAuthenticated ? (
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {session.user?.name ?? "Signed in"}
                  </p>
                  <p className="text-xs text-[color:var(--subtle)]">
                    {session.user?.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signOut()}
                  className="pill-button border border-slate-200 text-[color:var(--ink)] cursor-pointer"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => signIn("google")}
                className="pill-button bg-slate-900 text-white cursor-pointer inline-flex items-center gap-2"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                  <path
                    d="M12.2 10.2v3.6h5.1c-.2 1.2-1.6 3.5-5.1 3.5a5.9 5.9 0 0 1 0-11.8c2.1 0 3.5.9 4.3 1.7l2.9-2.8C17.6 2.7 15.1 1.5 12.2 1.5a10.5 10.5 0 1 0 0 21c6.1 0 10.2-4.3 10.2-10.3 0-.7-.1-1.2-.2-1.7H12.2Z"
                    fill="currentColor"
                  />
                </svg>
                Sign in
              </button>
            )}
          </div>
        </div>
      </div>

      <Modal
        title="Sign in"
        isOpen={showSignIn}
        onClose={() => setShowSignIn(false)}
      >
        <p className="text-sm text-[color:var(--subtle)]">
          Sign in with Google to create a profile and post prayers.
        </p>
        <button
          type="button"
          onClick={() => signIn("google")}
          className="mt-4 pill-button bg-slate-900 text-white cursor-pointer inline-flex items-center gap-2"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path
              d="M12.2 10.2v3.6h5.1c-.2 1.2-1.6 3.5-5.1 3.5a5.9 5.9 0 0 1 0-11.8c2.1 0 3.5.9 4.3 1.7l2.9-2.8C17.6 2.7 15.1 1.5 12.2 1.5a10.5 10.5 0 1 0 0 21c6.1 0 10.2-4.3 10.2-10.3 0-.7-.1-1.2-.2-1.7H12.2Z"
              fill="currentColor"
            />
          </svg>
          Continue with Google
        </button>
      </Modal>

      <Modal
        title="Notifications"
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        align="left"
      >
        {isLoadingNotifications ? (
          <p className="text-sm text-[color:var(--subtle)]">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-[color:var(--subtle)]">
            No notifications yet.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {notifications.map((note) => (
              <div key={note._id} className="panel p-3">
                <p className="text-sm text-[color:var(--ink)]">
                  <span className="font-semibold">
                    {note.actorId?.name ?? "Someone"}
                  </span>{" "}
                {note.type === "pray"
                    ? "prayed for your prayer."
                    : note.type === "comment"
                      ? "commented on your prayer."
                      : note.type === "word_like"
                        ? "prayed for your word."
                        : "commented on your word."}
                </p>
                {note.prayerId?.content && (
                  <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2">
                    “{note.prayerId.content}”
                  </p>
                )}
                {note.wordId?.content && (
                  <p className="mt-2 text-xs text-[color:var(--subtle)] line-clamp-2">
                    “{note.wordId.content}”
                  </p>
                )}
                <p className="mt-2 text-xs text-[color:var(--subtle)]">
                  {new Date(note.createdAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </aside>
  );
}
