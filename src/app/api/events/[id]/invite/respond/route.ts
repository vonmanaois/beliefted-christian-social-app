import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventInviteModel from "@/models/EventInvite";
import EventModel from "@/models/Event";
import NotificationModel from "@/models/Notification";

const RespondSchema = z.object({
  status: z.enum(["accepted", "declined"]),
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

  const parsed = RespondSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await dbConnect();
  const invite = await EventInviteModel.findOne({
    eventId: id,
    inviteeId: session.user.id,
  });
  if (!invite) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }

  invite.status = parsed.data.status;
  await invite.save();

  const event = await EventModel.findById(id).select("hostId").lean();
  if (event) {
    await NotificationModel.create({
      userId: event.hostId,
      actorId: session.user.id,
      type: invite.status === "accepted" ? "event_invite_accepted" : "event_invite_declined",
      eventId: event._id,
    });
  }

  return NextResponse.json({ status: invite.status });
}
