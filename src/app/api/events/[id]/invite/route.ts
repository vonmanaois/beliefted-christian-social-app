import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventInviteModel from "@/models/EventInvite";
import NotificationModel from "@/models/Notification";
import UserModel from "@/models/User";

const InviteSchema = z.object({
  inviteeId: z.string().optional(),
  inviteeUsername: z.string().trim().optional(),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  const parsed = InviteSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success || (!parsed.data.inviteeId && !parsed.data.inviteeUsername)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await dbConnect();

  const event = await EventModel.findById(id).select("hostId").lean();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (String(event.hostId) !== String(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let inviteeId = parsed.data.inviteeId ?? null;
  if (!inviteeId && parsed.data.inviteeUsername) {
    const user = await UserModel.findOne({
      username: parsed.data.inviteeUsername.toLowerCase(),
    })
      .select("_id")
      .lean();
    inviteeId = user ? String(user._id) : null;
  }

  if (!inviteeId) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (String(inviteeId) === String(session.user.id)) {
    return NextResponse.json({ error: "Cannot invite yourself" }, { status: 400 });
  }

  const existing = await EventInviteModel.findOne({
    eventId: event._id,
    inviteeId,
  }).lean();

  if (!existing) {
    await EventInviteModel.create({
      eventId: event._id,
      inviterId: session.user.id,
      inviteeId,
      status: "pending",
    });

    await NotificationModel.create({
      userId: inviteeId,
      actorId: session.user.id,
      type: "event_invite",
      eventId: event._id,
    });
  }

  return NextResponse.json({ ok: true });
}
