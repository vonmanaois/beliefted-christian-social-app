"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import Modal from "@/components/layout/Modal";
import UserSearch from "@/components/layout/UserSearch";
import EventList from "@/components/events/EventList";
import EventForm from "@/components/events/EventForm";
import type { EventItem } from "@/components/events/types";

export default function EventBoard() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"upcoming" | "past">("upcoming");
  const [inviteTarget, setInviteTarget] = useState<EventItem | null>(null);
  const [editTarget, setEditTarget] = useState<EventItem | null>(null);
  const [inviteUsername, setInviteUsername] = useState("");
  const [inviteeId, setInviteeId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!inviteTarget || (!inviteeId && !inviteUsername.trim())) return;
    setInviteBusy(true);
    setInviteMessage(null);
    try {
      const response = await fetch(`/api/events/${inviteTarget._id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inviteeId: inviteeId ?? undefined,
          inviteeUsername: inviteeId ? undefined : inviteUsername.trim(),
        }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setInviteMessage(payload?.error ?? "Failed to send invite.");
        return;
      }
      setInviteMessage("Invite sent!");
      setInviteUsername("");
      setInviteeId(null);
    } finally {
      setInviteBusy(false);
    }
  };

  return (
    <section className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[color:var(--ink)]">Events</h1>
          <p className="text-sm text-[color:var(--subtle)]">
            Host gatherings and invite your community.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel)] px-3 py-2 text-sm font-semibold text-[color:var(--ink)] hover:text-[color:var(--accent)]"
        >
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--surface)]">
            <Plus size={14} />
          </span>
          <span className="whitespace-nowrap">Create event</span>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("upcoming")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
            activeTab === "upcoming"
              ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] border-transparent"
              : "border-[color:var(--panel-border)] text-[color:var(--ink)]"
          }`}
        >
          Upcoming
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("past")}
          className={`rounded-full px-4 py-1.5 text-xs font-semibold border ${
            activeTab === "past"
              ? "bg-[color:var(--accent)] text-[color:var(--accent-contrast)] border-transparent"
              : "border-[color:var(--panel-border)] text-[color:var(--ink)]"
          }`}
        >
          Past
        </button>
      </div>

      <EventList
        refreshKey={refreshKey}
        tab={activeTab}
        onInvite={(event) => {
          setInviteTarget(event);
          setInviteMessage(null);
          setInviteUsername("");
          setInviteeId(null);
        }}
        onEdit={(event) => {
          setEditTarget(event);
        }}
      />

      <Modal title="Create Event" isOpen={showCreate} onClose={() => setShowCreate(false)}>
        <EventForm
          onCreated={() => {
            setShowCreate(false);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      </Modal>

      <Modal
        title={editTarget ? `Edit ${editTarget.title}` : "Edit Event"}
        isOpen={Boolean(editTarget)}
        onClose={() => setEditTarget(null)}
      >
        <EventForm
          initialEvent={editTarget}
          onUpdated={() => {
            setEditTarget(null);
            setRefreshKey((prev) => prev + 1);
          }}
        />
      </Modal>

      <Modal
        title={inviteTarget ? `Invite to ${inviteTarget.title}` : "Invite to event"}
        isOpen={Boolean(inviteTarget)}
        onClose={() => setInviteTarget(null)}
      >
        <div className="flex flex-col gap-3">
          <label className="text-xs font-semibold text-[color:var(--subtle)]">
            Invite by username
          </label>
          <UserSearch
            placeholder="Search people to invite..."
            onSelect={(user) => {
              setInviteUsername(user.username ? `@${user.username}` : "");
              setInviteeId(user.id);
            }}
          />
          {inviteMessage ? (
            <p className="text-xs text-[color:var(--subtle)]">{inviteMessage}</p>
          ) : null}
          <button
            type="button"
            disabled={inviteBusy || (!inviteeId && inviteUsername.trim().length < 2)}
            onClick={handleInvite}
            className="rounded-full px-4 py-2 text-sm font-semibold bg-[color:var(--accent)] text-[color:var(--accent-contrast)] disabled:opacity-60"
          >
            {inviteBusy ? "Sending..." : "Send Invite"}
          </button>
        </div>
      </Modal>
    </section>
  );
}
