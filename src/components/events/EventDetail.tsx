"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarBlank, MapPin, UsersThree } from "@phosphor-icons/react";
import { cloudinaryTransform } from "@/lib/cloudinary";
import type { EventItem } from "@/components/events/types";
import PostBackHeader from "@/components/ui/PostBackHeader";
import EventComments from "@/components/events/EventComments";

export default function EventDetail() {
  const params = useParams();
  const id = params?.id as string;

  const { data, isLoading, isError } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const response = await fetch(`/api/events/${id}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load event");
      }
      return (await response.json()) as { event: EventItem };
    },
    enabled: Boolean(id),
  });

  const { data: attendeeData } = useQuery({
    queryKey: ["event-attendees", id],
    queryFn: async () => {
      const response = await fetch(`/api/events/${id}/attendees`, { cache: "no-store" });
      if (!response.ok) {
        return { items: [] as { user?: { name?: string | null; username?: string | null } | null; status: string }[] };
      }
      return (await response.json()) as {
        items: { user?: { name?: string | null; username?: string | null } | null; status: string }[];
      };
    },
    enabled: Boolean(id),
  });

  const [rsvpStatus, setRsvpStatus] = useState<"going" | "interested" | "not_going" | null>(null);
  const [goingCount, setGoingCount] = useState(0);
  const [interestedCount, setInterestedCount] = useState(0);
  const [rsvpBusy, setRsvpBusy] = useState(false);

  useEffect(() => {
    if (!data?.event) return;
    setRsvpStatus(data.event.rsvpStatus ?? null);
    setGoingCount(data.event.goingCount ?? 0);
    setInterestedCount(data.event.interestedCount ?? 0);
  }, [data?.event]);

  const handleRsvp = async (status: "going" | "interested" | "not_going") => {
    if (rsvpBusy || !id) return;
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
    setRsvpBusy(true);
    try {
      const response = await fetch(`/api/events/${id}/rsvp?status=${status}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) {
        setRsvpStatus(prevStatus);
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
      setRsvpBusy(false);
    }
  };

  if (isLoading) {
    return <p className="text-sm text-[color:var(--subtle)]">Loading event...</p>;
  }
  if (isError || !data?.event) {
    return <p className="text-sm text-[color:var(--subtle)]">Event not found.</p>;
  }

  const event = data.event;
  const start = new Date(event.startAt);
  const end = event.endAt ? new Date(event.endAt) : null;
  const dateLabel = Number.isNaN(start.getTime())
    ? "Date TBD"
    : start.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
  const endLabel =
    end && !Number.isNaN(end.getTime())
      ? end.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })
      : null;

  return (
    <div className="flex flex-col gap-4">
      <PostBackHeader label="Event" />
      {event.posterImage ? (
        <div className="relative h-48 w-full rounded-2xl overflow-hidden border border-[color:var(--panel-border)]">
          <Image
            src={cloudinaryTransform(event.posterImage, {
              width: 1400,
              height: 700,
              autoOrient: true,
            })}
            alt={event.title}
            fill
            sizes="(max-width: 768px) 100vw, 720px"
            className="object-cover"
          />
        </div>
      ) : null}
      <div className="panel p-4">
        <h1 className="text-xl font-semibold text-[color:var(--ink)]">{event.title}</h1>
        {event.description ? (
          <p className="mt-2 text-sm text-[color:var(--subtle)]">{event.description}</p>
        ) : null}
        <div className="mt-4 flex flex-col gap-2 text-xs text-[color:var(--subtle)]">
          <div className="flex items-center gap-2">
            <CalendarBlank size={14} />
            <span>{endLabel ? `${dateLabel} - ${endLabel}` : dateLabel}</span>
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
        {event.locationText ? (
          <div className="mt-3">
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                event.locationText
              )}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--ink)]"
            >
              Open in Maps
            </a>
            <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--panel-border)]">
              <iframe
                title="Event location map"
                src={`https://www.google.com/maps?q=${encodeURIComponent(
                  event.locationText
                )}&output=embed`}
                className="h-48 w-full"
                loading="lazy"
              />
            </div>
          </div>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handleRsvp("going")}
            disabled={rsvpBusy}
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
            onClick={() => handleRsvp("interested")}
            disabled={rsvpBusy}
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
              onClick={() => handleRsvp("not_going")}
              disabled={rsvpBusy}
              className="rounded-full px-3 py-1.5 text-xs font-semibold border border-[color:var(--panel-border)] text-[color:var(--subtle)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>
      <EventComments eventId={event._id} isHost={event.isHost} />
      <div className="panel p-4">
        <h2 className="text-sm font-semibold text-[color:var(--ink)]">Attendees</h2>
        <div className="mt-3 flex flex-col gap-2">
          {(attendeeData?.items ?? []).length === 0 ? (
            <p className="text-xs text-[color:var(--subtle)]">No RSVPs yet.</p>
          ) : (
            attendeeData?.items.map((item, index) => (
              <div key={`${item.user?.username ?? "user"}-${index}`} className="flex items-center justify-between text-sm">
                <span className="text-[color:var(--ink)]">
                  {item.user?.name ?? item.user?.username ?? "Guest"}
                </span>
                <span className="text-xs text-[color:var(--subtle)]">{item.status}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
