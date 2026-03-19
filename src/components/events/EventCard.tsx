"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, MapPin, UsersThree, PaperPlaneTilt } from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import { cloudinaryTransform } from "@/lib/cloudinary";
import type { EventItem } from "@/components/events/types";

type EventCardProps = {
  event: EventItem;
  onInvite?: (event: EventItem) => void;
  onEdit?: (event: EventItem) => void;
};

export default function EventCard({ event, onInvite, onEdit }: EventCardProps) {
  const router = useRouter();
  const [rsvpStatus, setRsvpStatus] = useState(event.rsvpStatus ?? null);
  const [goingCount, setGoingCount] = useState(event.goingCount ?? 0);
  const [interestedCount, setInterestedCount] = useState(event.interestedCount ?? 0);
  const [inviteStatus, setInviteStatus] = useState(event.inviteStatus ?? null);
  const [busy, setBusy] = useState(false);
  const [showShareConfirm, setShowShareConfirm] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const stopClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation();
  };

  const start = useMemo(() => new Date(event.startAt), [event.startAt]);
  const end = useMemo(
    () => (event.endAt ? new Date(event.endAt) : null),
    [event.endAt]
  );
  const dateLabel = useMemo(() => {
    if (Number.isNaN(start.getTime())) return "Date TBD";
    const date = start.toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    const time = start.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
    const endTime =
      end && !Number.isNaN(end.getTime())
        ? end.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
        : null;
    return endTime ? `${date} • ${time} - ${endTime}` : `${date} • ${time}`;
  }, [start, end]);

  const handleRsvp = async (status: "going" | "interested" | "not_going") => {
    if (busy) return;
    const prevStatus = rsvpStatus;
    const prevGoing = goingCount;
    const prevInterested = interestedCount;
    let nextGoing = goingCount;
    let nextInterested = interestedCount;
    if (prevStatus === "going") nextGoing -= 1;
    if (prevStatus === "interested") nextInterested -= 1;
    if (status === "going") nextGoing += 1;
    if (status === "interested") nextInterested += 1;
    setRsvpStatus(status);
    setGoingCount(Math.max(nextGoing, 0));
    setInterestedCount(Math.max(nextInterested, 0));
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${event._id}/rsvp?status=${status}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setRsvpStatus(prevStatus ?? null);
        setGoingCount(prevGoing);
        setInterestedCount(prevInterested);
        return;
      }
      const payload = (await response.json()) as {
        status: "going" | "interested" | "not_going";
        goingCount: number;
        interestedCount: number;
      };
      setRsvpStatus(payload.status);
      setGoingCount(payload.goingCount);
      setInterestedCount(payload.interestedCount);
    } finally {
      setBusy(false);
    }
  };

  const handleInviteResponse = async (status: "accepted" | "declined") => {
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/events/${event._id}/invite/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) return;
      const payload = (await response.json()) as { status: "accepted" | "declined" };
      setInviteStatus(payload.status);
    } finally {
      setBusy(false);
    }
  };

  return (
    <article
      className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel)] overflow-hidden cursor-pointer"
      onClick={() => router.push(`/events/${event._id}`)}
    >
      {event.posterImage ? (
        <div className="relative h-40 w-full">
          <Image
            src={cloudinaryTransform(event.posterImage, { width: 1200, height: 600 })}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 640px"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="p-4 sm:p-5 flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--subtle)]">
            Event
          </p>
          <h3 className="text-lg font-semibold text-[color:var(--ink)]">
            {event.title}
          </h3>
          {event.description ? (
            <p className="text-sm text-[color:var(--subtle)]">{event.description}</p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 text-xs text-[color:var(--subtle)]">
          <div className="flex items-center gap-2">
            <CalendarBlank size={14} />
            <span>{dateLabel}</span>
          </div>
          {event.locationText ? (
            <div className="flex items-center gap-2">
              <MapPin size={14} />
              <span>{event.locationText}</span>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <UsersThree size={14} />
            <span>
              {goingCount} going · {interestedCount} interested
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={(event) => {
              stopClick(event);
              handleRsvp("going");
            }}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
              rsvpStatus === "going"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] border-transparent"
                : "border-[color:var(--panel-border)] text-[color:var(--ink)]"
            }`}
          >
            Going
          </button>
          <button
            type="button"
            onClick={(event) => {
              stopClick(event);
              handleRsvp("interested");
            }}
            disabled={busy}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold border ${
              rsvpStatus === "interested"
                ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] border-transparent"
                : "border-[color:var(--panel-border)] text-[color:var(--ink)]"
            }`}
          >
            Interested
          </button>
          {rsvpStatus && rsvpStatus !== "not_going" ? (
            <button
              type="button"
              onClick={(event) => {
                stopClick(event);
                handleRsvp("not_going");
              }}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--subtle)]"
            >
              Clear
            </button>
          ) : null}
          {event.isHost && onInvite ? (
            <button
              type="button"
              onClick={(eventClick) => {
                stopClick(eventClick);
                onInvite(event);
              }}
              className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)]"
            >
              Invite
            </button>
          ) : null}
          {event.isHost && onEdit ? (
            <button
              type="button"
              onClick={(eventClick) => {
                stopClick(eventClick);
                onEdit(event);
              }}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)]"
            >
              Edit
            </button>
          ) : null}
          {!event.isHost && inviteStatus === "pending" ? (
            <>
              <button
                type="button"
                onClick={(event) => {
                  stopClick(event);
                  handleInviteResponse("accepted");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--accent)] text-[color:var(--accent)]"
              >
                Accept
              </button>
              <button
                type="button"
                onClick={(event) => {
                  stopClick(event);
                  handleInviteResponse("declined");
                }}
                className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--subtle)]"
              >
                Decline
              </button>
            </>
          ) : null}
          {!event.isHost && inviteStatus === "accepted" ? (
            <span className="text-xs font-semibold text-[color:var(--accent)]">
              Invite accepted
            </span>
          ) : null}
          {!event.isHost && inviteStatus === "declined" ? (
            <span className="text-xs font-semibold text-[color:var(--subtle)]">
              Invite declined
            </span>
          ) : null}
          <button
            type="button"
            onClick={(event) => {
              stopClick(event);
              setShareMessage(null);
              setShowShareConfirm(true);
            }}
            className="ml-auto rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--ink)] inline-flex items-center gap-1"
          >
            <PaperPlaneTilt size={12} />
            Share
          </button>
        </div>
      </div>
      <Modal
        title="Share event to your wall?"
        isOpen={showShareConfirm}
        onClose={() => setShowShareConfirm(false)}
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
              onClick={() => setShowShareConfirm(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-[color:var(--ink)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={shareBusy}
              onClick={async () => {
                if (shareBusy) return;
                setShareBusy(true);
                setShareMessage(null);
                try {
                  const response = await fetch("/api/words", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sharedEventId: event._id }),
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
                  setTimeout(() => setShowShareConfirm(false), 400);
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
    </article>
  );
}
