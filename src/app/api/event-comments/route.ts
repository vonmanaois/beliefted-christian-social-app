import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import EventCommentModel from "@/models/EventComment";
import EventModel from "@/models/Event";
import NotificationModel from "@/models/Notification";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { notifyMentions } from "@/lib/mentionNotifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`event-comment-post:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const EventCommentSchema = z.object({
    content: z.string().trim().min(1).max(1000),
    eventId: z.string().min(1),
    parentId: z.string().min(1).optional(),
  });

  const body = EventCommentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Event ID and content are required" },
      { status: 400 }
    );
  }

  const content = body.data.content.trim();
  const eventId = body.data.eventId;
  const parentId = body.data.parentId ?? null;

  if (!content || !eventId) {
    return NextResponse.json(
      { error: "Event ID and content are required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const event = await EventModel.findById(eventId).select("hostId").lean();
  if (event?.hostId && String(event.hostId) !== String(session.user.id)) {
    await NotificationModel.create({
      userId: event.hostId,
      actorId: session.user.id,
      eventId,
      type: "event_comment",
    });
  }

  let isHostReply = false;
  if (parentId) {
    if (!event?.hostId || String(event.hostId) !== String(session.user.id)) {
      return NextResponse.json({ error: "Only the host can reply" }, { status: 403 });
    }
    const parent = await EventCommentModel.findOne({ _id: parentId, eventId })
      .select("_id")
      .lean();
    if (!parent) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
    isHostReply = true;
  }

  const comment = await EventCommentModel.create({
    content,
    userId: session.user.id,
    eventId,
    parentId,
    isHostReply,
  });

  await notifyMentions({
    text: content,
    actorId: session.user.id,
  });

  return NextResponse.json(comment, { status: 201 });
}
