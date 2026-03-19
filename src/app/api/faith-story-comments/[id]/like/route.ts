import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryCommentModel from "@/models/FaithStoryComment";
import NotificationModel from "@/models/Notification";

const normalizeId = (raw: string) => raw.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid comment ID" }, { status: 400 });
  }

  await dbConnect();

  const comment = await FaithStoryCommentModel.findById(cleanedId)
    .select("likedBy userId storyId")
    .lean();
  if (!comment) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  const userId = String(session.user.id);
  const alreadyLiked = (comment.likedBy ?? []).some((id) => String(id) === userId);
  const update = alreadyLiked
    ? { $pull: { likedBy: session.user.id } }
    : { $addToSet: { likedBy: session.user.id } };
  const updated = await FaithStoryCommentModel.findByIdAndUpdate(cleanedId, update, {
    new: true,
  }).lean();
  const likeCount = updated?.likedBy?.length ?? comment.likedBy?.length ?? 0;

  const commentOwnerId = String(comment.userId);
  if (commentOwnerId !== userId) {
    if (alreadyLiked) {
      await NotificationModel.deleteMany({
        userId: commentOwnerId,
        actorId: session.user.id,
        faithStoryId: comment.storyId,
        type: "faith_comment_like",
      });
    } else {
      await NotificationModel.create({
        userId: commentOwnerId,
        actorId: session.user.id,
        faithStoryId: comment.storyId,
        type: "faith_comment_like",
      });
    }
  }

  return NextResponse.json({ liked: !alreadyLiked, likeCount });
}
