import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventInviteModel from "@/models/EventInvite";
import EventRSVPModel from "@/models/EventRSVP";
import UserModel from "@/models/User";

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

  const rsvps = await EventRSVPModel.find({
    eventId: event._id,
    status: { $in: ["going", "interested"] },
  })
    .select("userId status createdAt")
    .lean();

  const userIds = rsvps.map((rsvp) => String(rsvp.userId));
  const users = userIds.length
    ? await UserModel.find({ _id: { $in: userIds } })
        .select("name username image")
        .lean()
    : [];
  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      { name: user.name, username: user.username, image: user.image },
    ])
  );

  return NextResponse.json({
    items: rsvps.map((rsvp) => ({
      user: userMap.get(String(rsvp.userId)) ?? null,
      status: rsvp.status,
      createdAt: rsvp.createdAt,
    })),
  });
}
