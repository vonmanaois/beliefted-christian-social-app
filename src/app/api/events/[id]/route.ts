import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventInviteModel from "@/models/EventInvite";
import EventRSVPModel from "@/models/EventRSVP";
import UserModel from "@/models/User";
import { z } from "zod";

const UpdateEventSchema = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(2000).optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  locationText: z.string().trim().max(200).optional(),
  posterImage: z.string().trim().url().optional().nullable(),
  visibility: z.enum(["public", "followers", "private"]).optional(),
  capacity: z.number().int().min(1).max(100000).optional().nullable(),
});

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  await dbConnect();
  const event = await EventModel.findById(id).lean();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isHost = viewerId ? String(event.hostId) === String(viewerId) : false;
  if (event.visibility !== "public" && !viewerId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isHost && event.visibility === "followers") {
    const user = await UserModel.findById(viewerId).select("following").lean();
    const following = Array.isArray(user?.following) ? user.following : [];
    const isFollower = following.some((followedId) => String(followedId) === String(event.hostId));
    if (!isFollower) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  let inviteStatus: string | null = null;
  if (!isHost && event.visibility === "private") {
    const invite = await EventInviteModel.findOne({
      eventId: event._id,
      inviteeId: viewerId,
      status: { $in: ["pending", "accepted"] },
    })
      .select("status")
      .lean();
    inviteStatus = invite?.status ?? null;
    if (!inviteStatus) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const host = await UserModel.findById(event.hostId)
    .select("name username image")
    .lean();

  const rsvp =
    viewerId && event._id
      ? await EventRSVPModel.findOne({ eventId: event._id, userId: viewerId })
          .select("status")
          .lean()
      : null;

  return NextResponse.json({
    event: {
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
      host: host
        ? { name: host.name, username: host.username, image: host.image }
        : null,
      isHost,
      rsvpStatus: rsvp?.status ?? null,
      inviteStatus,
    },
  });
}

export async function PATCH(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const parsed = UpdateEventSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await dbConnect();
  const event = await EventModel.findById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (String(event.hostId) !== String(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (parsed.data.startAt) {
    const startAt = new Date(parsed.data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    event.startAt = startAt;
  }

  if (parsed.data.endAt) {
    const endAt = new Date(parsed.data.endAt);
    if (Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid end time" }, { status: 400 });
    }
    event.endAt = endAt;
  }

  if (parsed.data.title !== undefined) event.title = parsed.data.title;
  if (parsed.data.description !== undefined) event.description = parsed.data.description;
  if (parsed.data.locationText !== undefined) event.locationText = parsed.data.locationText;
  if (parsed.data.posterImage !== undefined) event.posterImage = parsed.data.posterImage ?? null;
  if (parsed.data.visibility !== undefined) event.visibility = parsed.data.visibility;
  if (parsed.data.capacity !== undefined) event.capacity = parsed.data.capacity ?? null;

  if (event.endAt && event.startAt && event.endAt < event.startAt) {
    return NextResponse.json({ error: "End time must be after start time" }, { status: 400 });
  }

  await event.save();

  return NextResponse.json({ ok: true });
}
