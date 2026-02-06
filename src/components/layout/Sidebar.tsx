"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  BellSimple,
  GoogleLogo,
  House,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  UserCircle,
} from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import ThemeToggle from "@/components/layout/ThemeToggle";
import UserSearch from "@/components/layout/UserSearch";

export default function Sidebar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showThemes, setShowThemes] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
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

  const { data: notifications = [], isLoading: isLoadingNotifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      return (await response.json()) as NotificationItem[];
    },
    enabled: showNotifications && isAuthenticated,
  });

  const openNotifications = () => {
    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }
    setShowNotifications(true);
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as { username?: string | null };
        if (typeof data.username === "string") {
          setProfileUsername(data.username);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadProfile();
  }, [isAuthenticated]);

  return (
    <>
      <aside className="hidden md:flex p-5 flex-col gap-5 h-fit items-center text-center md:items-start md:text-left bg-transparent border-none shadow-none">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-3 text-left cursor-pointer"
      >
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#2d6cdf] to-[#9b6cff]" />
        <div className="hidden md:block">
          <p className="text-sm font-semibold text-[color:var(--ink)]">Lifted</p>
          <p className="text-xs text-[color:var(--subtle)]">Prayer Wall</p>
        </div>
      </button>

      <div className="hidden md:block w-full">
        <UserSearch />
      </div>

      <button
        type="button"
        onClick={() => setShowSearch(true)}
        className="md:hidden h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center text-[color:var(--ink)] hover:text-[color:var(--accent)] cursor-pointer"
        aria-label="Search people"
      >
        <MagnifyingGlass size={22} weight="regular" />
      </button>

      <div className="flex flex-col gap-3 text-base text-[color:var(--ink)]">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => router.push("/")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <House size={22} weight="regular" />
          </span>
          <span className="hidden md:inline">Home</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => {
            if (isAuthenticated) {
              if (profileUsername) {
                router.push(`/profile/${profileUsername}`);
              } else {
                router.push("/profile");
              }
            } else {
              setShowSignIn(true);
            }
          }}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <UserCircle size={22} weight="regular" />
          </span>
          <span className="hidden md:inline">Profile</span>
        </button>
        <a
          href="#prayer-form"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--accent)] text-white flex items-center justify-center">
            <Plus size={22} weight="regular" />
          </span>
          <span className="hidden md:inline">Post a Prayer</span>
        </a>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          aria-label="Notifications"
          onClick={openNotifications}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <BellSimple size={22} weight="regular" />
          </span>
          <span className="hidden md:inline">Notifications</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => setShowThemes((prev) => !prev)}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <SlidersHorizontal size={22} weight="regular" />
          </span>
          <span className="hidden md:inline">Preferences</span>
        </button>
      </div>

      <div
        className={`hidden md:block overflow-hidden transition-all duration-300 ${
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
                <GoogleLogo size={16} weight="regular" />
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
        <GoogleLogo size={16} weight="regular" />
        Continue with Google
      </button>
      </Modal>

      <Modal
        title="Search"
        isOpen={showSearch}
        onClose={() => setShowSearch(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-[color:var(--subtle)]">
            Find people by name or username.
          </p>
          <UserSearch />
        </div>
      </Modal>

      <Modal
        title="Notifications"
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        align="left"
      >
        {isLoadingNotifications ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="panel p-3">
                <div className="h-3 w-40 bg-slate-200 rounded-full animate-pulse" />
                <div className="mt-2 h-3 w-32 bg-slate-200 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="panel p-4 text-sm text-[color:var(--subtle)]">
            <p className="text-[color:var(--ink)] font-semibold">
              No notifications yet.
            </p>
            <p className="mt-1">When someone interacts, you’ll see it here.</p>
          </div>
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
                        ? "liked your word."
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

      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[color:var(--panel-border)] bg-[color:var(--panel)]/95 backdrop-blur">
        <div className="flex items-center justify-around px-5 py-4 text-[color:var(--ink)]">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => router.push("/")}
          >
            <House size={24} weight="regular" />
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => {
              if (isAuthenticated) {
                if (profileUsername) {
                  router.push(`/profile/${profileUsername}`);
                } else {
                  router.push("/profile");
                }
              } else {
                setShowSignIn(true);
              }
            }}
          >
            <UserCircle size={24} weight="regular" />
          </button>
          <a
            href="#prayer-form"
            className="flex flex-col items-center gap-1 text-[color:var(--accent)]"
          >
            <Plus size={24} weight="regular" />
          </a>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={openNotifications}
          >
            <BellSimple size={24} weight="regular" />
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => setShowSearch(true)}
            aria-label="Search people"
          >
            <MagnifyingGlass size={24} weight="regular" />
          </button>
        </div>
      </nav>
    </>
  );
}
