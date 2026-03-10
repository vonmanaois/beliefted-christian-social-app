import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventInviteModel from "@/models/EventInvite";
import EventRSVPModel from "@/models/EventRSVP";
import NotificationModel from "@/models/Notification";
import UserModel from "@/models/User";

const RsvpSchema = z.object({
  status: z.enum(["going", "interested", "not_going"]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const viewerId = session.user.id;
  const { id } = await params;

  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const fromQuery = searchParams.get("status");
  const parsedQuery = RsvpSchema.safeParse({ status: fromQuery });
  const parsedBody = RsvpSchema.safeParse(await req.json().catch(() => null));
  const status = parsedQuery.success
    ? parsedQuery.data.status
    : parsedBody.success
      ? parsedBody.data.status
      : null;
  if (!status) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await dbConnect();
  const event = await EventModel.findById(id).lean();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const isHost = String(event.hostId) === String(viewerId);
  if (!isHost && event.visibility === "followers") {
    const user = await UserModel.findById(viewerId).select("following").lean();
    const following = Array.isArray(user?.following) ? user.following : [];
    const isFollower = following.some((followedId) => String(followedId) === String(event.hostId));
    if (!isFollower) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!isHost && event.visibility === "private") {
    const invite = await EventInviteModel.findOne({
      eventId: event._id,
      inviteeId: viewerId,
      status: { $in: ["pending", "accepted"] },
    })
      .select("_id")
      .lean();
    if (!invite) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const existing = await EventRSVPModel.findOne({
    eventId: event._id,
    userId: viewerId,
  }).lean();

  const nextStatus = status;
  const prevStatus = existing?.status ?? null;

  const inc = { goingCount: 0, interestedCount: 0 };
  if (prevStatus === "going") inc.goingCount -= 1;
  if (prevStatus === "interested") inc.interestedCount -= 1;
  if (nextStatus === "going") inc.goingCount += 1;
  if (nextStatus === "interested") inc.interestedCount += 1;

  if (existing) {
    await EventRSVPModel.updateOne(
      { _id: existing._id },
      { $set: { status: nextStatus } }
    );
  } else {
    await EventRSVPModel.create({
      eventId: event._id,
      userId: viewerId,
      status: nextStatus,
    });
  }

  if (inc.goingCount !== 0 || inc.interestedCount !== 0) {
    await EventModel.updateOne({ _id: event._id }, { $inc: inc });
  }

  if (!isHost) {
    await NotificationModel.create({
      userId: event.hostId,
      actorId: viewerId,
      type: "event_rsvp",
      eventId: event._id,
    });
  }

  const updated = await EventModel.findById(event._id)
    .select("goingCount interestedCount")
    .lean();

  return NextResponse.json({
    status: nextStatus,
    goingCount: updated?.goingCount ?? event.goingCount ?? 0,
    interestedCount: updated?.interestedCount ?? event.interestedCount ?? 0,
  });
}
