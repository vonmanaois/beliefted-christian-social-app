"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, MapPin, PaperPlaneTilt } from "@phosphor-icons/react";
import type { EventItem } from "@/components/events/types";
import Modal from "@/components/layout/Modal";

export default function EventFeedPreview() {
  const router = useRouter();
  const [shareTarget, setShareTarget] = useState<EventItem | null>(null);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["events", "preview"],
    queryFn: async () => {
      const response = await fetch("/api/events?limit=3", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load events");
      }
      return (await response.json()) as { items: EventItem[] };
    },
  });

  if (isLoading) {
    return (
      <div className="border-b border-[color:var(--panel-border)] px-4 py-4 sm:px-6">
        <p className="text-xs text-[color:var(--subtle)]">Loading events...</p>
      </div>
    );
  }

  const items = data?.items ?? [];
  if (items.length === 0) return null;

  return (
    <div className="border-b border-[color:var(--panel-border)] px-4 py-4 sm:px-6">
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--subtle)]">
          Upcoming Events
        </p>
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
              className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] p-3"
            >
              <p className="text-sm font-semibold text-[color:var(--ink)]">{event.title}</p>
              <div className="mt-2 flex flex-col gap-1 text-[11px] text-[color:var(--subtle)]">
                <div className="flex items-center gap-2">
                  <CalendarBlank size={12} />
                  <span>{dateLabel}</span>
                </div>
                {event.locationText ? (
                  <div className="flex items-center gap-2">
                    <MapPin size={12} />
                    <span>{event.locationText}</span>
                  </div>
                ) : null}
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    router.push(`/events/${event._id}`);
                  }}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)]"
                >
                  View
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShareTarget(event);
                    setShareMessage(null);
                  }}
                  className="rounded-full px-3 py-1 text-[11px] font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)] inline-flex items-center gap-1"
                >
                  <PaperPlaneTilt size={12} />
                  Share
                </button>
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
