import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventCommentModel from "@/models/EventComment";
import EventInviteModel from "@/models/EventInvite";
import EventRSVPModel from "@/models/EventRSVP";
import UserModel from "@/models/User";
import NotificationModel from "@/models/Notification";

const CreateEventSchema = z.object({
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().optional().nullable(),
  locationText: z.string().trim().max(200).optional().nullable(),
  posterImage: z.string().trim().url().optional().nullable(),
  visibility: z.enum(["public", "followers", "private"]).optional().nullable(),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const { searchParams } = new URL(req.url);
  const limitParam = Number(searchParams.get("limit") ?? 30);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 60) : 30;
  const cursor = searchParams.get("cursor");
  const tab = searchParams.get("tab") === "past" ? "past" : "upcoming";
  const now = new Date();

  await dbConnect();

  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const expired = await EventModel.find({
    $or: [
      { endAt: { $lt: cutoff } },
      { endAt: { $exists: false }, startAt: { $lt: cutoff } },
    ],
  })
    .select("_id")
    .lean();
  if (expired.length) {
    const expiredIds = expired.map((item) => item._id);
    await EventModel.deleteMany({ _id: { $in: expiredIds } });
    await EventRSVPModel.deleteMany({ eventId: { $in: expiredIds } });
    await EventInviteModel.deleteMany({ eventId: { $in: expiredIds } });
    await EventCommentModel.deleteMany({ eventId: { $in: expiredIds } });
  }

  let followingIds: Types.ObjectId[] = [];
  if (viewerId) {
    const currentUser = await UserModel.findById(viewerId).select("following").lean();
    const rawFollowing = Array.isArray(currentUser?.following) ? currentUser.following : [];
    followingIds = rawFollowing
      .map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id))
      .filter(Boolean);
  }

  let invitedEventIds: Types.ObjectId[] = [];
  const inviteStatusMap = new Map<string, string>();
  if (viewerId) {
    const invites = await EventInviteModel.find({
      inviteeId: viewerId,
      status: { $in: ["pending", "accepted"] },
    })
      .select("eventId status")
      .lean();
    invitedEventIds = invites
      .map((invite) =>
        typeof invite.eventId === "string" ? new Types.ObjectId(invite.eventId) : invite.eventId
      )
      .filter(Boolean);
    invites.forEach((invite) => {
      inviteStatusMap.set(String(invite.eventId), invite.status);
    });
  }

  const visibilityOr: Record<string, unknown>[] = [{ visibility: "public" }];
  if (viewerId) {
    visibilityOr.push({ hostId: viewerId });
    if (followingIds.length) {
      visibilityOr.push({ visibility: "followers", hostId: { $in: followingIds } });
    }
    if (invitedEventIds.length) {
      visibilityOr.push({ visibility: "private", _id: { $in: invitedEventIds } });
    }
  }

  const conditions: Record<string, unknown>[] = [{ $or: visibilityOr }];
  if (tab === "past") {
    conditions.push({
      $or: [
        { endAt: { $lt: now } },
        { endAt: { $exists: false }, startAt: { $lt: now } },
      ],
    });
  } else {
    conditions.push({
      $or: [
        { endAt: { $gte: now } },
        { endAt: { $exists: false }, startAt: { $gte: now } },
      ],
    });
  }
  const sortDirection = tab === "past" ? -1 : 1;
  if (cursor) {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [startAtRaw, idRaw] = decoded.split("|");
    const startAt = startAtRaw ? new Date(startAtRaw) : null;
    const cursorId = idRaw && Types.ObjectId.isValid(idRaw) ? new Types.ObjectId(idRaw) : null;
    if (startAt && !Number.isNaN(startAt.getTime())) {
      const comparator = sortDirection === -1 ? "$lt" : "$gt";
      conditions.push({
        $or: [
          { startAt: { [comparator]: startAt } },
          ...(cursorId ? [{ startAt, _id: { [comparator]: cursorId } }] : []),
        ],
      });
    }
  }

  const events = await EventModel.find({ $and: conditions })
    .sort({ startAt: sortDirection, _id: sortDirection })
    .limit(limit + 1)
    .lean();

  const hasMore = events.length > limit;
  const pageItems = hasMore ? events.slice(0, limit) : events;

  const hostIds = Array.from(
    new Set(pageItems.map((event) => String(event.hostId)).filter(Boolean))
  );
  const hosts = hostIds.length
    ? await UserModel.find({ _id: { $in: hostIds } })
        .select("name username image")
        .lean()
    : [];
  const hostMap = new Map(
    hosts.map((user) => [
      String(user._id),
      { name: user.name, username: user.username, image: user.image },
    ])
  );

  const eventIds = pageItems.map((event) => event._id);
  const rsvps =
    viewerId && eventIds.length
      ? await EventRSVPModel.find({ eventId: { $in: eventIds }, userId: viewerId })
          .select("eventId status")
          .lean()
      : [];
  const rsvpMap = new Map(
    rsvps.map((rsvp) => [String(rsvp.eventId), rsvp.status])
  );

  const items = pageItems.map((event) => ({
    _id: String(event._id),
    title: event.title,
    description: event.description ?? "",
    startAt: event.startAt,
    endAt: event.endAt ?? null,
    locationText: event.locationText ?? "",
    posterImage: event.posterImage ?? null,
    visibility: event.visibility ?? "public",
    capacity: event.capacity ?? null,
    goingCount: event.goingCount ?? 0,
    interestedCount: event.interestedCount ?? 0,
    host: hostMap.get(String(event.hostId)) ?? null,
    isHost: viewerId ? String(event.hostId) === String(viewerId) : false,
    rsvpStatus: viewerId ? (rsvpMap.get(String(event._id)) ?? null) : null,
    inviteStatus: viewerId ? (inviteStatusMap.get(String(event._id)) ?? null) : null,
  }));

  const nextCursor = hasMore
    ? Buffer.from(
        `${pageItems[pageItems.length - 1]?.startAt?.toISOString?.() ?? ""}|${
          pageItems[pageItems.length - 1]?._id ?? ""
        }`
      ).toString("base64")
    : null;

  return NextResponse.json({ items, nextCursor });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = CreateEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const startAt = new Date(parsed.data.startAt);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
  }

  let endAt: Date | undefined;
  if (parsed.data.endAt) {
    endAt = new Date(parsed.data.endAt);
    if (Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    }
  }

  if (endAt && endAt.getTime() < startAt.getTime()) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  await dbConnect();

  const event = await EventModel.create({
    title: parsed.data.title,
    description: parsed.data.description ?? "",
    startAt,
    endAt,
    locationText: parsed.data.locationText ?? "",
    posterImage: parsed.data.posterImage ?? null,
    visibility: parsed.data.visibility ?? "public",
    hostId: session.user.id,
    capacity: parsed.data.capacity ?? null,
  });

  if (event.visibility !== "private") {
    const host = await UserModel.findById(session.user.id)
      .select("followers")
      .lean();
    const followers = Array.isArray(host?.followers) ? host.followers : [];
    const notifications = followers
      .filter((followerId) => String(followerId) !== String(session.user.id))
      .map((followerId) => ({
        userId: followerId,
        actorId: session.user.id,
        type: "event_posted",
        eventId: event._id,
      }));
    if (notifications.length) {
      await NotificationModel.insertMany(notifications, { ordered: false });
    }
  }

  return NextResponse.json({ id: String(event._id) });
}
