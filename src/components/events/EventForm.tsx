"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { cloudinaryTransform } from "@/lib/cloudinary";
import type { EventItem } from "@/components/events/types";

type EventFormProps = {
  onCreated?: () => void;
  onUpdated?: () => void;
  initialEvent?: EventItem | null;
};

const toLocalInput = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const snapToQuarterHour = (value: string) => {
  if (!value) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const minutes = date.getMinutes();
  const snapped = Math.round(minutes / 15) * 15;
  if (snapped === 60) {
    date.setHours(date.getHours() + 1);
    date.setMinutes(0);
  } else {
    date.setMinutes(snapped);
  }
  date.setSeconds(0);
  date.setMilliseconds(0);
  return toLocalInput(date);
};

type GoogleMapsPlace = {
  formatted_address?: string;
  name?: string;
};

type GoogleMapsAutocomplete = {
  addListener: (event: string, handler: () => void) => { remove?: () => void };
  getPlace: () => GoogleMapsPlace;
};

type GoogleMapsNamespace = {
  maps?: {
    places?: {
      Autocomplete: new (
        input: HTMLInputElement,
        opts?: { fields?: string[]; types?: string[] }
      ) => GoogleMapsAutocomplete;
    };
  };
};

export default function EventForm({ onCreated, onUpdated, initialEvent }: EventFormProps) {
  const { status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [title, setTitle] = useState(initialEvent?.title ?? "");
  const [description, setDescription] = useState(initialEvent?.description ?? "");
  const [startAt, setStartAt] = useState(toLocalInput(initialEvent?.startAt));
  const [endAt, setEndAt] = useState(toLocalInput(initialEvent?.endAt ?? null));
  const [locationText, setLocationText] = useState(initialEvent?.locationText ?? "");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">(
    initialEvent?.visibility ?? "public"
  );
  const [capacity, setCapacity] = useState(
    initialEvent?.capacity ? String(initialEvent.capacity) : ""
  );
  const [posterFile, setPosterFile] = useState<File | null>(null);
  const [posterPreview, setPosterPreview] = useState<string | null>(
    initialEvent?.posterImage ?? null
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const locationInputRef = useRef<HTMLInputElement | null>(null);
  const [mapsReady, setMapsReady] = useState(false);
  const mapsKey =
    typeof process !== "undefined" ? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? "" : "";

  useEffect(() => {
    if (!initialEvent) return;
    setTitle(initialEvent.title ?? "");
    setDescription(initialEvent.description ?? "");
    setStartAt(toLocalInput(initialEvent.startAt));
    setEndAt(toLocalInput(initialEvent.endAt ?? null));
    setLocationText(initialEvent.locationText ?? "");
    setVisibility(initialEvent.visibility ?? "public");
    setCapacity(initialEvent.capacity ? String(initialEvent.capacity) : "");
    setPosterPreview(initialEvent.posterImage ?? null);
    setPosterFile(null);
  }, [initialEvent]);

  useEffect(() => {
    if (!mapsKey || typeof window === "undefined") return;
    const existing = Boolean(
      (window as { google?: GoogleMapsNamespace }).google?.maps?.places
    );
    if (existing) {
      setMapsReady(true);
      return;
    }
    const script = document.querySelector(
      'script[data-google-maps="true"]'
    ) as HTMLScriptElement | null;
    if (script) {
      const onLoad = () => setMapsReady(true);
      script.addEventListener("load", onLoad, { once: true });
      return () => script.removeEventListener("load", onLoad);
    }
    const nextScript = document.createElement("script");
    nextScript.src = `https://maps.googleapis.com/maps/api/js?key=${mapsKey}&libraries=places`;
    nextScript.async = true;
    nextScript.defer = true;
    nextScript.dataset.googleMaps = "true";
    nextScript.onload = () => setMapsReady(true);
    document.head.appendChild(nextScript);
  }, [mapsKey]);

  useEffect(() => {
    if (!mapsReady || !mapsKey || typeof window === "undefined") return;
    const input = locationInputRef.current;
    if (!input) return;
    const google = (window as { google?: GoogleMapsNamespace }).google;
    if (!google?.maps?.places?.Autocomplete) return;
    const autocomplete = new google.maps.places.Autocomplete(input, {
      fields: ["formatted_address", "name"],
      types: ["geocode"],
    });
    const listener = autocomplete.addListener("place_changed", () => {
      const place = autocomplete.getPlace();
      const next = place?.formatted_address || place?.name;
      if (next) {
        setLocationText(next);
      }
    });
    return () => {
      if (listener?.remove) listener.remove();
    };
  }, [mapsReady, mapsKey]);

  const openSignIn = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("open-signin"));
    }
  };

  const uploadPoster = async () => {
    if (!posterFile) return null;
    const response = await fetch("/api/cloudinary/sign-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: 1 }),
    });
    if (!response.ok) {
      throw new Error("Failed to prepare upload");
    }
    const payload = (await response.json()) as {
      cloudName: string;
      apiKey: string;
      uploads: {
        publicId: string;
        signature: string;
        timestamp: number;
        folder: string;
        invalidate: string;
      }[];
    };
    const upload = payload.uploads?.[0];
    if (!upload) {
      throw new Error("Upload config missing");
    }
    const formData = new FormData();
    formData.append("file", posterFile);
    formData.append("api_key", payload.apiKey);
    formData.append("timestamp", String(upload.timestamp));
    formData.append("signature", upload.signature);
    formData.append("folder", upload.folder);
    formData.append("public_id", upload.publicId);
    formData.append("invalidate", upload.invalidate);
    const uploadResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${payload.cloudName}/image/upload`,
      { method: "POST", body: formData }
    );
    if (!uploadResponse.ok) {
      throw new Error("Upload failed");
    }
    const data = (await uploadResponse.json()) as { secure_url?: string };
    return data.secure_url ?? null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!isAuthenticated) {
      openSignIn();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const uploadedPoster = posterFile ? await uploadPoster() : null;
      const posterImage = uploadedPoster ?? initialEvent?.posterImage ?? null;
      const startIso = new Date(startAt).toISOString();
      const endIso = endAt ? new Date(endAt).toISOString() : undefined;
      const trimmedTitle = title.trim();
      const trimmedDescription = description.trim();
      const trimmedLocation = locationText.trim();
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        startAt: startIso,
        endAt: endIso,
        visibility,
        capacity: capacity ? Number(capacity) : undefined,
      };
      if (trimmedDescription) {
        payload.description = trimmedDescription;
      }
      if (trimmedLocation) {
        payload.locationText = trimmedLocation;
      }
      if (posterImage) {
        payload.posterImage = posterImage;
      }
      if (!endIso) {
        delete payload.endAt;
      }
      const response = await fetch(initialEvent ? `/api/events/${initialEvent._id}` : "/api/events", {
        method: initialEvent ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Failed to create event.");
        return;
      }
      setTitle("");
      setDescription("");
      setStartAt("");
      setEndAt("");
      setLocationText("");
      setVisibility("public");
      setCapacity("");
      setPosterFile(null);
      setPosterPreview(null);
      if (initialEvent) {
        onUpdated?.();
      } else {
        onCreated?.();
      }
    } catch (err) {
      setError((err as Error)?.message ?? "Failed to create event.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-semibold text-[color:var(--subtle)]">Title</label>
        <input
          className="soft-input text-sm w-full mt-1"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Church picnic, worship night..."
          required
        />
      </div>
      <div>
        <label className="text-xs font-semibold text-[color:var(--subtle)]">Description</label>
        <textarea
          className="soft-input text-sm w-full mt-1 min-h-[90px]"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What is this event about?"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[color:var(--subtle)]">Start</label>
          <input
            type="datetime-local"
            className="soft-input text-sm w-full mt-1"
            value={startAt}
            onChange={(event) => setStartAt(event.target.value)}
            onBlur={() => setStartAt((value) => snapToQuarterHour(value))}
            step={900}
            required
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-[color:var(--subtle)]">End</label>
          <input
            type="datetime-local"
            className="soft-input text-sm w-full mt-1"
            value={endAt}
            onChange={(event) => setEndAt(event.target.value)}
            onBlur={() => setEndAt((value) => snapToQuarterHour(value))}
            step={900}
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-[color:var(--subtle)]">Location</label>
        <input
          ref={locationInputRef}
          className="soft-input text-sm w-full mt-1"
          value={locationText}
          onChange={(event) => setLocationText(event.target.value)}
          placeholder="Church hall, 123 Main St"
        />
        {locationText ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-black/10">
            <iframe
              title="Event location map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(
                locationText
              )}&output=embed`}
              className="h-40 w-full"
              loading="lazy"
            />
          </div>
        ) : null}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-[color:var(--subtle)]">Visibility</label>
          <select
            className="soft-input text-sm w-full mt-1"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value as typeof visibility)}
          >
            <option value="public">Public</option>
            <option value="followers">Followers</option>
            <option value="private">Private (invites only)</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-[color:var(--subtle)]">Capacity</label>
          <input
            type="number"
            min={1}
            className="soft-input text-sm w-full mt-1"
            value={capacity}
            onChange={(event) => setCapacity(event.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-semibold text-[color:var(--subtle)]">Poster</label>
        <div className="mt-2 flex items-center gap-3">
          <input
            type="file"
            accept="image/*"
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setPosterFile(file);
              setPosterPreview(file ? URL.createObjectURL(file) : null);
            }}
          />
          {posterPreview ? (
            <Image
              src={
                posterPreview.startsWith("blob:")
                  ? posterPreview
                  : cloudinaryTransform(posterPreview, { width: 120, height: 80 })
              }
              alt="Poster preview"
              width={96}
              height={64}
              unoptimized
              className="h-16 w-24 rounded-lg object-cover"
            />
          ) : null}
        </div>
      </div>
      {error ? <p className="text-xs text-[color:var(--danger)]">{error}</p> : null}
      <button
        type="submit"
        disabled={busy}
        className="rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] disabled:opacity-60"
      >
        {busy ? "Saving..." : initialEvent ? "Save Changes" : "Create Event"}
      </button>
    </form>
  );
}
