import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryCommentModel from "@/models/FaithStoryComment";
import FaithStoryModel from "@/models/FaithStory";
import NotificationModel from "@/models/Notification";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { Types } from "mongoose";
import { notifyMentions } from "@/lib/mentionNotifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`faith-story-comment:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const CommentSchema = z.object({
    content: z.string().trim().min(1).max(1000),
    storyId: z.string().min(1),
    parentId: z.string().min(1).optional(),
  });

  const body = CommentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Story ID and content are required" }, { status: 400 });
  }

  const content = body.data.content.trim();
  const cleanedStoryId = body.data.storyId.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  const parentId = body.data.parentId ?? null;
  const storyObjectId = Types.ObjectId.isValid(cleanedStoryId)
    ? new Types.ObjectId(cleanedStoryId)
    : null;

  if (!content || !storyObjectId) {
    return NextResponse.json({ error: "Story ID and content are required" }, { status: 400 });
  }

  await dbConnect();

  let parentUserId: string | null = null;
  if (parentId) {
    const parent = await FaithStoryCommentModel.findOne({ _id: parentId, storyId: storyObjectId })
      .select("userId")
      .lean();
    if (!parent?.userId) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
    parentUserId = String(parent.userId);
  }

  const comment = await FaithStoryCommentModel.create({
    content,
    userId: session.user.id,
    storyId: storyObjectId,
    parentId,
  });

  const story = await FaithStoryModel.findById(storyObjectId).select("userId").lean();
  if (story?.userId && story.userId.toString() !== session.user.id) {
    const storyOwnerId = String(story.userId);
    if (!parentUserId || parentUserId !== storyOwnerId) {
    await NotificationModel.create({
      userId: story.userId,
      actorId: session.user.id,
      faithStoryId: storyObjectId,
      type: "faith_comment",
    });
    }
  }

  if (parentUserId && parentUserId !== String(session.user.id)) {
    await NotificationModel.create({
      userId: parentUserId,
      actorId: session.user.id,
      faithStoryId: storyObjectId,
      type: "faith_comment_reply",
    });
  }

  await notifyMentions({
    text: content,
    actorId: session.user.id,
    faithStoryId: storyObjectId.toString(),
  });

  return NextResponse.json(comment, { status: 201 });
}
