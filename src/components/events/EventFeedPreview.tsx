"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { CalendarBlank, MapPin, PaperPlaneTilt, X } from "@phosphor-icons/react";
import type { EventItem } from "@/components/events/types";
import Modal from "@/components/layout/Modal";
import { cloudinaryTransform } from "@/lib/cloudinary";

export default function EventFeedPreview() {
  const router = useRouter();
  const [shareTarget, setShareTarget] = useState<EventItem | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const isDismissed = useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const handler = () => callback();
      window.addEventListener("storage", handler);
      window.addEventListener("beliefted:events-preview", handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener("beliefted:events-preview", handler);
      };
    },
    () => {
      if (typeof window === "undefined") return false;
      return window.localStorage.getItem("eventsPreviewDismissed") === "true";
    },
    () => false
  );
  const { data, isLoading } = useQuery({
    queryKey: ["events", "preview"],
    queryFn: async () => {
      const response = await fetch("/api/events?limit=3&tab=upcoming", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load events");
      }
      return (await response.json()) as { items: EventItem[] };
    },
  });

  if (isLoading) {
    return (
      <div className="px-4 py-2 sm:px-6">
        <p className="text-xs text-[color:var(--subtle)]">Loading events...</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  if (isDismissed) {
    return (
      <div className="px-4 py-2 sm:px-6 text-xs text-[color:var(--subtle)]">
        Upcoming events hidden.
        <button
          type="button"
          onClick={() => {
            window.localStorage.removeItem("eventsPreviewDismissed");
            window.dispatchEvent(new Event("beliefted:events-preview"));
          }}
          className="ml-2 font-semibold text-[color:var(--accent)] hover:text-[color:var(--accent)]"
        >
          Show again
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-[color:var(--subtle)]">
            Upcoming Events
          </p>
          <button
            type="button"
            onClick={() => {
              window.localStorage.setItem("eventsPreviewDismissed", "true");
              window.dispatchEvent(new Event("beliefted:events-preview"));
            }}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full text-[color:var(--subtle)] hover:text-[color:var(--accent)]"
            aria-label="Hide events preview"
          >
            <X size={16} />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            if (typeof window === "undefined") return;
            window.location.href = "/events";
          }}
          className="text-xs font-semibold text-[color:var(--accent)]"
        >
          See all
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {items.map((event) => {
          const start = new Date(event.startAt);
          const dateLabel = Number.isNaN(start.getTime())
            ? "Date TBD"
            : start.toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                weekday: "short",
              });
          return (
            <div
              key={event._id}
              className="overflow-hidden rounded-[26px] border border-[color:var(--panel-border)]/70 bg-[color:var(--panel)] shadow-[0_12px_30px_rgba(0,0,0,0.12)]"
            >
              <div className="h-1 w-full bg-[color:var(--accent)]/70" />
              {event.posterImage ? (
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-[color:var(--surface)]">
                  <Image
                    src={cloudinaryTransform(event.posterImage, {
                      width: 1200,
                      height: 900,
                      autoOrient: true,
                    })}
                    alt={event.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 420px"
                    className="object-cover [image-orientation:from-image]"
                  />
                </div>
              ) : (
                <div className="aspect-[4/3] w-full bg-[linear-gradient(135deg,color-mix(in_srgb,var(--accent)_18%,transparent),transparent_58%),linear-gradient(180deg,color-mix(in_srgb,var(--surface-strong)_92%,transparent),color-mix(in_srgb,var(--panel)_96%,transparent))]" />
              )}
              <div className="p-4">
                <p className="text-lg font-semibold leading-tight text-[color:var(--ink)]">
                  {event.title}
                </p>
                <div className="mt-3 flex flex-col gap-2 text-[12px] text-[color:var(--subtle)]">
                  <div className="flex items-center gap-2">
                    <CalendarBlank size={13} />
                    <span>{dateLabel}</span>
                  </div>
                  {event.locationText ? (
                    <div className="flex items-center gap-2">
                      <MapPin size={13} />
                      <span>{event.locationText}</span>
                    </div>
                  ) : null}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/events/${event._id}`);
                    }}
                    className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-[12px] font-semibold text-[color:var(--accent-contrast)]"
                  >
                    View event
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShareTarget(event);
                      setShareMessage(null);
                    }}
                    className="inline-flex items-center gap-1 rounded-full border border-[color:var(--panel-border)] px-4 py-2 text-[12px] font-semibold text-[color:var(--ink)]"
                  >
                    <PaperPlaneTilt size={12} />
                    Share
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <Modal
        title="Share event to your wall?"
        isOpen={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm text-[color:var(--subtle)]">
            This will post the event card to your Word feed.
          </p>
          {shareMessage ? (
            <p className="text-xs text-[color:var(--subtle)]">{shareMessage}</p>
          ) : null}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setShareTarget(null)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={shareBusy || !shareTarget}
              onClick={async () => {
                if (!shareTarget) return;
                setShareBusy(true);
                setShareMessage(null);
                try {
                  const response = await fetch("/api/words", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sharedEventId: shareTarget._id }),
                  });
                  if (response.status === 401) {
                    window.dispatchEvent(new Event("open-signin"));
                    return;
                  }
                  if (!response.ok) {
                    const payload = (await response.json().catch(() => null)) as
                      | { error?: string }
                      | null;
                    setShareMessage(payload?.error ?? "Failed to share event.");
                    return;
                  }
                  setShareMessage("Posted to your wall.");
                  window.dispatchEvent(new Event("feed:refresh"));
                  setTimeout(() => setShareTarget(null), 400);
                } finally {
                  setShareBusy(false);
                }
              }}
              className="rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] disabled:opacity-60"
            >
              {shareBusy ? "Posting..." : "Share"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
