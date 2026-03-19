import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import DayStoryModel from "@/models/DayStory";
import NotificationModel from "@/models/Notification";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  await dbConnect();

  const story = await DayStoryModel.findById(id).select("likedBy expiresAt userId").lean();
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (story.expiresAt && story.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Story expired" }, { status: 410 });
  }

  const userId = String(session.user.id);
  const alreadyLiked = (story.likedBy ?? []).some((id) => String(id) === userId);
  const update = alreadyLiked
    ? { $pull: { likedBy: session.user.id } }
    : { $addToSet: { likedBy: session.user.id } };
  const updated = await DayStoryModel.findByIdAndUpdate(id, update, { new: true }).lean();
  const count = updated?.likedBy?.length ?? story.likedBy?.length ?? 0;

  const storyOwnerId = String(story.userId);
  if (storyOwnerId !== userId) {
    if (alreadyLiked) {
      await NotificationModel.deleteMany({
        userId: storyOwnerId,
        actorId: session.user.id,
        dayStoryId: id,
        type: "story_like",
      });
    } else {
      await NotificationModel.create({
        userId: storyOwnerId,
        actorId: session.user.id,
        dayStoryId: id,
        type: "story_like",
      });
    }
  }

  return NextResponse.json({ liked: !alreadyLiked, likeCount: count });
}
