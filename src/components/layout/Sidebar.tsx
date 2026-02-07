"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import {
  BellSimple,
  ChartBar,
  GoogleLogo,
  House,
  HandHeart,
  Info,
  MagnifyingGlass,
  Plus,
  SlidersHorizontal,
  User,
} from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import ThemeToggle from "@/components/layout/ThemeToggle";
import UserSearch from "@/components/layout/UserSearch";

export default function Sidebar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [showPreferences, setShowPreferences] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState(true);
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL ?? "von.manaois@gmail.com";
  const prefsButtonRef = useRef<HTMLButtonElement | null>(null);
  const mobilePrefsButtonRef = useRef<HTMLButtonElement | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const { data: notificationsCount = 0 } = useQuery({
    queryKey: ["notifications", "count"],
    queryFn: async () => {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      const data = (await response.json()) as Array<unknown>;
      return Array.isArray(data) ? data.length : 0;
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  useEffect(() => {
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", "count"] });
    };
    window.addEventListener("notifications:refresh", refresh);
    return () => window.removeEventListener("notifications:refresh", refresh);
  }, [queryClient]);

  useEffect(() => {
    if (!isAuthenticated || typeof window === "undefined") return;
    let source: EventSource | null = null;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!isAuthenticated) return;
      source = new EventSource("/api/notifications/stream");

      source.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as { count?: number };
          if (typeof payload.count === "number") {
            queryClient.setQueryData(["notifications", "count"], payload.count);
          }
        } catch {
          // ignore parse errors
        }
      };

      source.onerror = () => {
        source?.close();
        source = null;
        if (retryTimer) clearTimeout(retryTimer);
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 30000);
      };
    };

    connect();

    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [isAuthenticated, queryClient]);

  const openNotifications = () => {
    if (!isAuthenticated) {
      setShowSignIn(true);
      return;
    }
    router.push("/notifications");
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!isAuthenticated) return;
      try {
        const response = await fetch("/api/user/profile", { cache: "no-store" });
        if (!response.ok) return;
        const data = (await response.json()) as {
          username?: string | null;
          onboardingComplete?: boolean;
        };
        if (typeof data.username === "string") {
          setProfileUsername(data.username);
        }
        if (typeof data.onboardingComplete === "boolean") {
          setOnboardingComplete(data.onboardingComplete);
        }
      } catch (error) {
        console.error(error);
      }
    };

    loadProfile();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (onboardingComplete) return;
    if (pathname === "/onboarding") return;
    router.push("/onboarding");
  }, [isAuthenticated, onboardingComplete, pathname, router]);

  useEffect(() => {
    const handleOpenSignIn = () => setShowSignIn(true);
    window.addEventListener("open-signin", handleOpenSignIn);
    return () => window.removeEventListener("open-signin", handleOpenSignIn);
  }, []);

  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 bg-[color:var(--panel)]/95 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 h-12">
          <button
            type="button"
            onClick={() => router.push("/why-lifted")}
            className="h-10 w-10 rounded-xl bg-[color:var(--panel)] text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            aria-label="Why Lifted"
          >
            <Info size={22} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 cursor-pointer min-w-0"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-[#2d6cdf] to-[#9b6cff]" />
            <span className="hidden sm:inline text-sm font-semibold text-[color:var(--ink)] whitespace-nowrap">
              Lifted
            </span>
          </button>
          {isAuthenticated ? (
            <button
              type="button"
              ref={mobilePrefsButtonRef}
              onClick={() => setShowPreferences(true)}
              className="h-10 w-10 rounded-xl bg-[color:var(--panel)] text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              aria-label="Preferences"
            >
              <SlidersHorizontal size={22} weight="regular" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSignIn(true)}
              className="h-10 px-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] text-xs font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)] whitespace-nowrap"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
      <aside className="hidden lg:flex p-5 flex-col gap-5 h-fit items-center text-center lg:items-start lg:text-left bg-transparent border-none shadow-none">
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

      <div className="hidden lg:block w-full">
        <UserSearch />
      </div>

      <button
        type="button"
        onClick={() => router.push("/search")}
        className="lg:hidden h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center text-[color:var(--ink)] hover:text-[color:var(--accent)] cursor-pointer"
        aria-label="Search people"
      >
        <MagnifyingGlass size={22} weight="regular" />
      </button>

      <div className="flex flex-col gap-3 text-base text-[color:var(--ink)]">
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => {
            if (pathname !== "/") {
              router.push("/");
            }
            queryClient.invalidateQueries({ queryKey: ["prayers"] });
            queryClient.invalidateQueries({ queryKey: ["words"] });
          }}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <House size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Home</span>
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
            <User size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Profile</span>
        </button>
      <button
        type="button"
        onClick={() => {
          if (!isAuthenticated) {
            setShowSignIn(true);
            return;
          }
          if (typeof window !== "undefined") {
            const eventName =
              pathname === "/" || pathname === "/word" || pathname === "/wordoftheday"
                ? "open-word-composer"
                : "open-prayer-composer";
            window.dispatchEvent(new CustomEvent(eventName));
          }
        }}
        className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
      >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--accent)] text-[color:var(--accent-contrast)] flex items-center justify-center">
            <Plus size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Add</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          aria-label="Notifications"
          onClick={openNotifications}
        >
          <span className="relative h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <BellSimple size={22} weight="regular" />
            {isAuthenticated && notificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
            )}
          </span>
          <span className="hidden lg:inline">Notifications</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => router.push("/why-lifted")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <Info size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Why Lifted</span>
        </button>
        <a
          href="https://buy.stripe.com/test_28E28teaRgXcaIK72TfMA00"
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <HandHeart size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Donate</span>
        </a>
        {session?.user?.email === adminEmail && (
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => router.push("/analytics")}
          >
            <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
              <ChartBar size={22} weight="regular" />
            </span>
            <span className="hidden lg:inline">Analytics</span>
          </button>
        )}
        <button
          type="button"
          ref={prefsButtonRef}
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => {
            setShowPreferences(true);
          }}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <SlidersHorizontal size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Preferences</span>
        </button>
      </div>

      </aside>

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
        title="Preferences"
        isOpen={showPreferences}
        onClose={() => setShowPreferences(false)}
      >
        <div className="flex flex-col gap-4">
          <ThemeToggle />
          <div className="border-t border-slate-200 pt-4">
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
      </Modal>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[color:var(--panel-border)] bg-[color:var(--panel)]/95 backdrop-blur">
        <div className="flex items-center justify-around px-5 py-3 text-[color:var(--ink)]">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => {
              router.push("/");
              queryClient.invalidateQueries({ queryKey: ["prayers"] });
              queryClient.invalidateQueries({ queryKey: ["words"] });
            }}
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
            <User size={24} weight="regular" />
          </button>
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                const eventName =
                  pathname === "/" || pathname === "/word" || pathname === "/wordoftheday"
                    ? "open-word-composer"
                    : "open-prayer-composer";
                window.dispatchEvent(new CustomEvent(eventName));
              }
            }}
            className="flex flex-col items-center gap-1 text-[color:var(--accent)]"
            aria-label="Add a prayer"
          >
            <Plus size={24} weight="regular" />
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={openNotifications}
          >
            <span className="relative">
              <BellSimple size={24} weight="regular" />
              {isAuthenticated && notificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--accent)]" />
              )}
            </span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => router.push("/search")}
            aria-label="Search people"
          >
            <MagnifyingGlass size={24} weight="regular" />
          </button>
        </div>
      </nav>
    </>
  );
}
