"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { signIn, signOut, useSession } from "next-auth/react";
import { usePathname, useRouter } from "next/navigation";
import Image from "next/image";
import {
  BellSimple,
  BookOpenText,
  GoogleLogo,
  House,
  Info,
  List,
  Question,
  Notebook,
  MagnifyingGlass,
  SlidersHorizontal,
  User,
  X,
} from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import ThemeToggle from "@/components/layout/ThemeToggle";
import NotificationsContent from "@/components/notifications/NotificationsContent";
import WhyBelieftedContent from "@/components/info/WhyBelieftedContent";
import HowToDownloadContent from "@/components/info/HowToDownloadContent";
import CommunityGuidelinesContent from "@/components/info/CommunityGuidelinesContent";
import UserSearch from "@/components/layout/UserSearch";
import { useUIStore } from "@/lib/uiStore";

let unifiedStream: EventSource | null = null;
let unifiedStreamUsers = 0;
let unifiedStreamRetryDelay = 1000;
let unifiedStreamRetryTimer: ReturnType<typeof setTimeout> | null = null;
let unifiedStreamCloseTimer: ReturnType<typeof setTimeout> | null = null;
let unifiedStreamUserId: string | null = null;

export default function Sidebar() {
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const {
    signInOpen,
    openSignIn,
    closeSignIn,
    newWordPosts,
    newPrayerPosts,
    activeHomeTab,
    setActiveHomeTab,
    lastSeenNotificationsCount,
    setLastSeenNotificationsCount,
    setNewWordPosts,
    setNewPrayerPosts,
  } = useUIStore();
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);
  const lastUserIdRef = useRef<string | null>(null);
  const notificationsOpenRef = useRef(false);
  const sseConnectedRef = useRef(false);
  const currentUserIdRef = useRef<string | null>(null);
  const lastCountRefreshRef = useRef(0);
  const lastSseMessageAtRef = useRef(0);
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [isMenuClosing, setIsMenuClosing] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsClosing, setNotificationsClosing] = useState(false);
  const [infoPanel, setInfoPanel] = useState<"why" | "how" | "guidelines" | null>(null);
  const [infoClosing, setInfoClosing] = useState(false);
  const [menuMounted] = useState(true);
  const touchStartX = useRef<number | null>(null);
  const triggerPanelClose = (target: "search") => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("panel:close", { detail: { target } }));
    }
    setTimeout(() => {
      router.back();
    }, 220);
  };

  const openInfoPanel = useCallback((panel: "why" | "how" | "guidelines") => {
    setInfoClosing(false);
    setInfoPanel(panel);
  }, []);

  const closeInfoPanel = useCallback(() => {
    if (!infoPanel) return;
    setInfoClosing(true);
    setTimeout(() => {
      setInfoPanel(null);
      setInfoClosing(false);
    }, 220);
  }, [infoPanel]);

  const { data: notificationsCount = 0 } = useQuery({
    queryKey: ["notifications", "count", session?.user?.id ?? "guest"],
    queryFn: async () => {
      const response = await fetch("/api/notifications/count", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load notifications");
      }
      const data = (await response.json()) as { count?: number };
      return typeof data.count === "number" ? data.count : 0;
    },
    enabled: isAuthenticated,
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: true,
  });

  const hasUnreadNotifications =
    isAuthenticated && notificationsCount > lastSeenNotificationsCount;

  useEffect(() => {
    if (notificationsCount < lastSeenNotificationsCount) {
      setLastSeenNotificationsCount(notificationsCount);
    }
  }, [notificationsCount, lastSeenNotificationsCount, setLastSeenNotificationsCount]);

  useEffect(() => {
    const nextUserId = session?.user?.id ?? null;
    currentUserIdRef.current = nextUserId;
    if (lastUserIdRef.current === nextUserId) return;
    lastUserIdRef.current = nextUserId;
    setLastSeenNotificationsCount(0);
    setNewWordPosts(false);
    setNewPrayerPosts(false);
    queryClient.setQueryData(
      ["notifications", "count", nextUserId ?? "guest"],
      0
    );
  }, [session?.user?.id, queryClient, setLastSeenNotificationsCount, setNewWordPosts, setNewPrayerPosts]);

  useEffect(() => {
    // keep ref for potential future manual refresh hooks
    lastCountRefreshRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const poll = () => {
      if (sseConnectedRef.current) return;
      queryClient.invalidateQueries({
        queryKey: ["notifications", "count", session?.user?.id ?? "guest"],
      });
    };
    poll();
    const interval = window.setInterval(poll, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        poll();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isAuthenticated, queryClient, session?.user?.id]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isAuthenticated) {
      if (unifiedStreamCloseTimer) {
        clearTimeout(unifiedStreamCloseTimer);
        unifiedStreamCloseTimer = null;
      }
      if (unifiedStreamRetryTimer) {
        clearTimeout(unifiedStreamRetryTimer);
        unifiedStreamRetryTimer = null;
      }
      unifiedStream?.close();
      unifiedStream = null;
      unifiedStreamUsers = 0;
      return;
    }

    unifiedStreamUsers += 1;
    if (unifiedStreamCloseTimer) {
      clearTimeout(unifiedStreamCloseTimer);
      unifiedStreamCloseTimer = null;
    }

    const connect = () => {
      if (document.visibilityState === "hidden") return;
      if (unifiedStream) return;
      unifiedStream = new EventSource("/api/stream");
      unifiedStreamUserId = currentUserIdRef.current ?? null;

      unifiedStream.onopen = () => {
        unifiedStreamRetryDelay = 1000;
        sseConnectedRef.current = true;
        lastSseMessageAtRef.current = Date.now();
      };

      unifiedStream.onmessage = (event) => {
        try {
          lastSseMessageAtRef.current = Date.now();
          const viewerId = currentUserIdRef.current;
          if (!viewerId) return;
          const payload = JSON.parse(event.data) as {
            wordsChanged?: boolean;
            prayersChanged?: boolean;
            wordAuthorId?: string | null;
            prayerAuthorId?: string | null;
            wordAuthorIds?: string[];
            prayerAuthorIds?: string[];
            notificationsCount?: number;
            viewerId?: string | null;
          };
          if (payload.viewerId && payload.viewerId !== viewerId) return;
          const wordHasOtherAuthor =
            !payload.wordAuthorId || payload.wordAuthorId !== viewerId;
          const prayerHasOtherAuthor =
            !payload.prayerAuthorId || payload.prayerAuthorId !== viewerId;
          if (payload.wordsChanged && wordHasOtherAuthor) {
            setNewWordPosts(true);
          }
          if (payload.prayersChanged && prayerHasOtherAuthor) {
            setNewPrayerPosts(true);
          }
          if (typeof payload.notificationsCount === "number") {
            queryClient.setQueryData(
              ["notifications", "count", viewerId ?? "guest"],
              payload.notificationsCount
            );
            if (payload.notificationsCount > lastSeenNotificationsCount) {
              queryClient.invalidateQueries({
                queryKey: ["notifications", viewerId ?? "guest"],
              });
            }
            if (notificationsOpenRef.current) {
              queryClient.invalidateQueries({
                queryKey: ["notifications", viewerId ?? "guest"],
              });
            }
          }
        } catch {
          // ignore parse errors
        }
      };
      unifiedStream.addEventListener("ping", () => {
        lastSseMessageAtRef.current = Date.now();
      });

      unifiedStream.onerror = () => {
        unifiedStream?.close();
        unifiedStream = null;
        sseConnectedRef.current = false;
        if (unifiedStreamRetryTimer) {
          clearTimeout(unifiedStreamRetryTimer);
        }
        unifiedStreamRetryTimer = setTimeout(connect, unifiedStreamRetryDelay);
        unifiedStreamRetryDelay = Math.min(unifiedStreamRetryDelay * 2, 30000);
      };
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        unifiedStream?.close();
        unifiedStream = null;
        sseConnectedRef.current = false;
        return;
      }
      connect();
    };

    connect();
    document.addEventListener("visibilitychange", handleVisibility);
    const staleCheck = window.setInterval(() => {
      if (!sseConnectedRef.current) return;
      const last = lastSseMessageAtRef.current;
      if (!last) return;
      if (Date.now() - last > 45000) {
        unifiedStream?.close();
        unifiedStream = null;
        sseConnectedRef.current = false;
        connect();
      }
    }, 15000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.clearInterval(staleCheck);
      unifiedStreamUsers = Math.max(0, unifiedStreamUsers - 1);
      if (unifiedStreamUsers === 0) {
        unifiedStreamCloseTimer = setTimeout(() => {
          if (unifiedStreamRetryTimer) {
            clearTimeout(unifiedStreamRetryTimer);
            unifiedStreamRetryTimer = null;
          }
          unifiedStream?.close();
          unifiedStream = null;
          sseConnectedRef.current = false;
        }, 5000);
      }
    };
  }, [
    isAuthenticated,
    queryClient,
    session?.user?.id,
    setNewPrayerPosts,
    setNewWordPosts,
    lastSeenNotificationsCount,
  ]);

  useEffect(() => {
    const nextUserId = session?.user?.id ?? null;
    if (unifiedStreamUserId && unifiedStreamUserId !== nextUserId) {
      unifiedStream?.close();
      unifiedStream = null;
      sseConnectedRef.current = false;
    }
  }, [session?.user?.id]);

  const openNotifications = () => {
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    if (hasUnreadNotifications) {
      queryClient.invalidateQueries({
        queryKey: ["notifications", session?.user?.id ?? "guest"],
      });
    }
    setLastSeenNotificationsCount(notificationsCount);
    if (notificationsOpen) {
      closeNotifications();
      return;
    }
    setNotificationsClosing(false);
    setNotificationsOpen(true);
  };

  const hasHomeBadge = newWordPosts || newPrayerPosts;

  const { data: profileSummary } = useQuery({
    queryKey: ["profile", "summary"],
    queryFn: async () => {
      const response = await fetch("/api/user/profile", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load profile");
      }
      return (await response.json()) as {
        username?: string | null;
        onboardingComplete?: boolean;
      };
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const resolvedUsername =
    typeof profileSummary?.username === "string" ? profileSummary.username : null;
  const resolvedOnboardingComplete =
    typeof profileSummary?.onboardingComplete === "boolean"
      ? profileSummary.onboardingComplete
      : true;

  useEffect(() => {
    if (!isAuthenticated) return;
    if (resolvedOnboardingComplete) return;
    if (pathname === "/onboarding") return;
    router.push("/onboarding");
  }, [isAuthenticated, resolvedOnboardingComplete, pathname, router]);

  useEffect(() => {
    const handleOpenSignIn = () => openSignIn();
    window.addEventListener("open-signin", handleOpenSignIn);
    return () => window.removeEventListener("open-signin", handleOpenSignIn);
  }, [openSignIn]);

  const closeMenu = useCallback(() => {
    if (!showMobileMenu) return;
    setIsMenuClosing(true);
    setShowMobileMenu(false);
    window.setTimeout(() => {
      setIsMenuClosing(false);
    }, 220);
  }, [showMobileMenu]);

  const closeNotifications = useCallback(() => {
    if (!notificationsOpen) return;
    setNotificationsClosing(true);
    setNotificationsOpen(false);
    window.setTimeout(() => {
      setNotificationsClosing(false);
    }, 220);
  }, [notificationsOpen]);

  const toggleThemeMenu = useCallback(() => {
    setThemeMenuOpen((prev) => !prev);
  }, []);

  useEffect(() => {
    if (!showMobileMenu) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (mobileMenuRef.current?.contains(event.target as Node)) return;
      closeMenu();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [showMobileMenu, closeMenu]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (notificationsRef.current?.contains(event.target as Node)) return;
      closeNotifications();
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [notificationsOpen, closeNotifications]);

  useEffect(() => {
    notificationsOpenRef.current = notificationsOpen;
  }, [notificationsOpen]);

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      touchStartX.current = event.touches[0]?.clientX ?? null;
    };
    const handleTouchEnd = (event: TouchEvent) => {
      const startX = touchStartX.current;
      if (startX === null) return;
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const delta = endX - startX;
      if (!showMobileMenu && startX < 40 && delta > 60) {
        setIsMenuClosing(false);
        setShowMobileMenu(true);
      }
      if (showMobileMenu && delta < -60) {
        closeMenu();
      }

      if (!notificationsOpen && startX > window.innerWidth - 40 && delta < -60) {
        setNotificationsClosing(false);
        setNotificationsOpen(true);
      }
      if (notificationsOpen && delta > 60) {
        closeNotifications();
      }
      if (infoPanel && delta > 60) {
        closeInfoPanel();
      }
      touchStartX.current = null;
    };
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [showMobileMenu, notificationsOpen, infoPanel, closeMenu, closeNotifications, closeInfoPanel]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (showMobileMenu || isMenuClosing) {
      document.documentElement.classList.add("menu-open");
    } else {
      document.documentElement.classList.remove("menu-open");
    }
  }, [showMobileMenu, isMenuClosing]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (notificationsOpen || notificationsClosing) {
      document.documentElement.classList.add("notifications-open");
    } else {
      document.documentElement.classList.remove("notifications-open");
    }
  }, [notificationsOpen, notificationsClosing]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (infoPanel || infoClosing) {
      document.documentElement.classList.add("info-open");
    } else {
      document.documentElement.classList.remove("info-open");
    }
  }, [infoPanel, infoClosing]);

  return (
    <>
      <div className="lg:hidden sticky top-0 z-40 bg-[color:var(--panel)]/95 backdrop-blur">
        <div className="grid grid-cols-[120px_1fr_120px] items-center px-4 py-0 h-12">
          <div className="flex items-center gap-4 justify-start w-full text-[color:var(--ink)]">
            <button
              type="button"
              onClick={() => {
                if (showMobileMenu) {
                  closeMenu();
                  return;
                }
                setIsMenuClosing(false);
                setShowMobileMenu(true);
              }}
              className="flex items-center justify-center hover:text-[color:var(--accent)]"
              aria-label="Menu"
            >
              <List size={22} weight="regular" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-2 cursor-pointer min-w-0 justify-self-center"
          >
            <Image
              src="/images/beliefted-logo.svg"
              alt="Beliefted"
              width={36}
              height={36}
              priority
              className="h-9 w-9 rounded-full"
            />
            <span className="hidden sm:inline text-sm font-semibold text-[color:var(--ink)] whitespace-nowrap">
              Beliefted
            </span>
          </button>
          <div className="flex items-center gap-4 justify-end w-full text-[color:var(--ink)]">
            <button
              type="button"
              onClick={openNotifications}
              className="flex items-center justify-center hover:text-[color:var(--accent)]"
              aria-label="Notifications"
            >
              <span className="relative inline-flex">
                <BellSimple size={22} weight="regular" />
                {hasUnreadNotifications && (
                  <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[color:var(--badge)]" />
                )}
              </span>
            </button>
          </div>
        </div>
        {(showMobileMenu || isMenuClosing) && menuMounted &&
          createPortal(
            <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-transparent"
                aria-label="Close menu"
                onClick={closeMenu}
              />
              <div
                ref={mobileMenuRef}
                data-state={showMobileMenu ? "open" : "closing"}
                className="mobile-menu-panel absolute left-0 top-0 h-full w-[75vw] max-w-[360px] border-r border-[color:var(--panel-border)] bg-[color:var(--surface)] p-4 shadow-2xl flex flex-col overflow-hidden pb-5 min-h-0"
              >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                    Menu
                  </p>
                  <button
                    type="button"
                    onClick={closeMenu}
                    className="h-8 w-8 rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)] flex items-center justify-center"
                    aria-label="Close menu"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (pathname !== "/") {
                      router.push("/");
                    }
                  }}
                  className="mt-3 flex items-center gap-3 text-left"
                  aria-label="Go to home"
                >
                  <Image
                    src="/images/beliefted-logo.svg"
                    alt="Beliefted"
                    width={40}
                    height={40}
                    priority
                    className="h-10 w-10 rounded-full"
                  />
                  <div>
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      Beliefted
                    </p>
                    <p className="text-xs text-[color:var(--subtle)]">
                      Lifting others through prayer
                    </p>
                  </div>
                </button>
              </div>

              <div className="mt-3 flex flex-1 min-h-0 flex-col">
                <div>
                  <UserSearch />
                </div>

                <div className="mt-3 flex flex-col">
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      openInfoPanel("why");
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
                  >
                    Why Beliefted
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      openInfoPanel("how");
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
                  >
                    How To Download
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      closeMenu();
                      openInfoPanel("guidelines");
                    }}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
                  >
                    Community Guidelines
                  </button>
                  <button
                    type="button"
                    onClick={toggleThemeMenu}
                    className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--ink)] hover:bg-[color:var(--surface-strong)]"
                    aria-expanded={themeMenuOpen}
                  >
                    Theme
                  </button>
                  {themeMenuOpen && (
                    <div className="mt-3 rounded-xl bg-[color:var(--panel)] p-3">
                      <ThemeToggle />
                    </div>
                  )}
                </div>

                <div className="mt-4 border-t border-[color:var(--panel-border)] pt-3">
                  {isAuthenticated ? (
                    <div className="flex flex-col gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isAuthenticated) return;
                        const target = resolvedUsername ? `/profile/${resolvedUsername}` : "/profile";
                        router.push(target);
                      }}
                      className="flex items-center gap-3 text-left"
                      aria-label="Go to profile"
                    >
                      <span className="h-10 w-10 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
                        {session?.user?.image ? (
                          <Image
                            src={session.user.image}
                            alt=""
                              width={40}
                              height={40}
                              sizes="40px"
                              className="h-full w-full object-cover"
                            />
                          ) : (
                          <User size={20} weight="regular" />
                        )}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">
                          {session?.user?.name ?? "Signed in"}
                        </p>
                        <p className="text-xs text-[color:var(--subtle)]">
                          {resolvedUsername ? `@${resolvedUsername}` : session?.user?.email}
                        </p>
                      </div>
                    </button>
                      <button
                        type="button"
                        onClick={() => {
                          closeMenu();
                          signOut();
                        }}
                        className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] border border-[color:var(--danger)]"
                      >
                        Sign out
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        closeMenu();
                        openSignIn();
                      }}
                      className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--accent)] hover:bg-[color:var(--surface-strong)]"
                    >
                      Sign in
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>,
            document.body
          )}
        {(notificationsOpen || notificationsClosing) && menuMounted &&
          createPortal(
            <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-transparent"
                aria-label="Close notifications"
                onClick={closeNotifications}
              />
              <div
                ref={notificationsRef}
                data-state={notificationsOpen ? "open" : "closing"}
                className="notification-drawer-panel absolute right-0 top-0 h-full w-full border-l border-[color:var(--panel-border)] bg-[color:var(--surface)] shadow-2xl"
              >
                <div className="panel h-full rounded-none border-0 bg-transparent p-6 panel-scroll-mobile">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                        Notifications
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeNotifications}
                      className="h-9 w-9 rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)] flex items-center justify-center"
                      aria-label="Close notifications"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                  <div className="mt-4">
                    <NotificationsContent active={notificationsOpen} />
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
        {(infoPanel || infoClosing) && menuMounted &&
          createPortal(
            <div className="fixed inset-0 z-[85]" role="dialog" aria-modal="true">
              <button
                type="button"
                className="absolute inset-0 bg-transparent"
                aria-label="Close panel"
                onClick={closeInfoPanel}
              />
              <div
                data-state={infoClosing ? "closing" : "open"}
                className="info-drawer-panel absolute right-0 top-0 h-full w-full border-l border-[color:var(--panel-border)] bg-[color:var(--surface)] shadow-2xl"
              >
                <div className="panel h-full rounded-none border-0 bg-transparent p-6 panel-scroll-mobile">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--subtle)]">
                      {infoPanel === "why"
                        ? "Why Beliefted"
                        : infoPanel === "how"
                          ? "How To Download"
                          : "Community Guidelines"}
                    </p>
                    <button
                      type="button"
                      onClick={closeInfoPanel}
                      className="h-9 w-9 rounded-full border border-[color:var(--panel-border)] text-[color:var(--subtle)] flex items-center justify-center"
                      aria-label="Close panel"
                    >
                      <X size={14} weight="bold" />
                    </button>
                  </div>
                  <div className="mt-4">
                    {infoPanel === "why" ? (
                      <WhyBelieftedContent />
                    ) : infoPanel === "how" ? (
                      <HowToDownloadContent />
                    ) : (
                      <CommunityGuidelinesContent />
                    )}
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
      <aside className="hidden lg:flex p-5 flex-col gap-5 h-fit items-center text-center lg:items-start lg:text-left bg-transparent border-none shadow-none">
      <button
        type="button"
        onClick={() => router.push("/")}
        className="flex items-center gap-3 text-left cursor-pointer"
      >
        <Image
          src="/images/beliefted-logo.svg"
          alt="Beliefted"
          width={40}
          height={40}
          priority
          className="h-10 w-10 rounded-full"
        />
        <div className="hidden md:block">
          <p className="text-sm font-semibold text-[color:var(--ink)]">Beliefted</p>
          <p className="text-xs text-[color:var(--subtle)]">
            Faith that lifts others through prayer
          </p>
        </div>
      </button>

      <div className="hidden lg:block w-full">
        <UserSearch />
      </div>

      <button
        type="button"
        onClick={() => {
          if (pathname === "/search") {
            triggerPanelClose("search");
            return;
          }
          router.push("/search");
        }}
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
            setActiveHomeTab("words");
            if (activeHomeTab === "prayers") {
              if (newPrayerPosts) {
                queryClient.invalidateQueries({ queryKey: ["prayers"] });
              }
              setNewPrayerPosts(false);
            } else if (activeHomeTab === "following") {
              // Following uses staleTime + pull-to-refresh.
            } else {
              if (newWordPosts) {
                queryClient.invalidateQueries({ queryKey: ["words"] });
              }
              setNewWordPosts(false);
            }
          }}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <span className="relative inline-flex">
              <House size={22} weight="regular" />
              {hasHomeBadge && (
                <span className="absolute -top-1.5 -right-1.5 h-2.5 w-2.5 rounded-full bg-[color:var(--badge)]" />
              )}
            </span>
          </span>
          <span className="hidden lg:inline">Home</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => {
            if (isAuthenticated) {
              if (resolvedUsername) {
                router.push(`/profile/${resolvedUsername}`);
              } else {
                router.push("/profile");
              }
            } else {
              openSignIn();
            }
          }}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <User size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Profile</span>
        </button>
        {isAuthenticated && (
          <button
            type="button"
            className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => router.push("/journal")}
          >
            <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
              <Notebook size={22} weight="regular" />
            </span>
            <span className="hidden lg:inline">Journal</span>
          </button>
        )}
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          aria-label="Notifications"
          onClick={openNotifications}
        >
          <span className="relative h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <BellSimple size={22} weight="regular" />
            {hasUnreadNotifications && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--badge)]" />
            )}
          </span>
          <span className="hidden lg:inline">Notifications</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => router.push("/faith-stories")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <BookOpenText size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Faith Story</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => openInfoPanel("why")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <Info size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Why Beliefted</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => openInfoPanel("how")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <Question size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">How To Download</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={() => openInfoPanel("guidelines")}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <Info size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Community Guidelines</span>
        </button>
        <button
          type="button"
          className="flex items-center gap-3 cursor-pointer text-[color:var(--ink)] hover:text-[color:var(--accent)]"
          onClick={toggleThemeMenu}
        >
          <span className="h-10 w-10 rounded-2xl bg-[color:var(--panel)] flex items-center justify-center">
            <SlidersHorizontal size={22} weight="regular" />
          </span>
          <span className="hidden lg:inline">Themes</span>
        </button>
        {themeMenuOpen && (
          <div className="hidden lg:block rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-3">
            <ThemeToggle />
          </div>
        )}
        {isAuthenticated && (
          <div className="hidden lg:flex flex-col gap-3 rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-3">
            <button
              type="button"
              onClick={() => {
                const target = resolvedUsername ? `/profile/${resolvedUsername}` : "/profile";
                router.push(target);
              }}
              className="flex items-center gap-3 text-left"
              aria-label="Go to profile"
            >
              <span className="h-10 w-10 rounded-full bg-[color:var(--surface-strong)] overflow-hidden flex items-center justify-center text-[10px] font-semibold text-[color:var(--subtle)]">
                {session?.user?.image ? (
                  <Image
                    src={session.user.image}
                    alt=""
                    width={40}
                    height={40}
                    sizes="40px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <User size={20} weight="regular" />
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {session?.user?.name ?? "Signed in"}
                </p>
                <p className="text-xs text-[color:var(--subtle)]">
                  {resolvedUsername ? `@${resolvedUsername}` : session?.user?.email}
                </p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="w-full rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-[color:var(--danger)] border border-[color:var(--danger)]"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      </aside>

      <Modal
        title="Sign in"
        isOpen={signInOpen}
        onClose={closeSignIn}
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

      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-[color:var(--panel-border)] bg-[color:var(--panel)]/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-around px-5 py-3 text-[color:var(--ink)]">
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => {
            if (pathname !== "/") {
              router.push("/");
            }
            setActiveHomeTab("words");
            if (newWordPosts) {
              queryClient.invalidateQueries({ queryKey: ["words"] });
            }
            setNewWordPosts(false);
            }}
            aria-label="Home"
          >
            <span className="relative">
              <House size={24} weight="regular" />
              {hasHomeBadge && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-[color:var(--badge)]" />
              )}
            </span>
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => {
              if (isAuthenticated) {
                if (resolvedUsername) {
                  router.push(`/profile/${resolvedUsername}`);
                } else {
                  router.push("/profile");
                }
              } else {
                openSignIn();
              }
            }}
          >
            <User size={24} weight="regular" />
          </button>
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => {
              if (pathname === "/search") {
                triggerPanelClose("search");
                return;
              }
              router.push("/search");
            }}
            aria-label="Search people"
          >
            <MagnifyingGlass size={24} weight="regular" />
          </button>
          {isAuthenticated && (
            <button
              type="button"
              className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
              onClick={() => router.push("/journal")}
              aria-label="Journal"
            >
              <Notebook size={24} weight="regular" />
            </button>
          )}
          <button
            type="button"
            className="flex flex-col items-center gap-1 text-[color:var(--ink)] hover:text-[color:var(--accent)]"
            onClick={() => router.push("/faith-stories")}
            aria-label="Faith Stories"
          >
            <BookOpenText size={24} weight="regular" />
          </button>
        </div>
      </nav>
    </>
  );
}
