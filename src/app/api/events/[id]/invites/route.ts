import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventModel from "@/models/Event";
import EventInviteModel from "@/models/EventInvite";
import UserModel from "@/models/User";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  await dbConnect();
  const event = await EventModel.findById(id).select("hostId").lean();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (String(event.hostId) !== String(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const invites = await EventInviteModel.find({ eventId: event._id })
    .select("inviteeId status createdAt")
    .lean();
  const inviteeIds = invites.map((invite) => String(invite.inviteeId));
  const users = inviteeIds.length
    ? await UserModel.find({ _id: { $in: inviteeIds } })
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
    items: invites.map((invite) => ({
      invitee: userMap.get(String(invite.inviteeId)) ?? null,
      status: invite.status,
      createdAt: invite.createdAt,
    })),
  });
}
