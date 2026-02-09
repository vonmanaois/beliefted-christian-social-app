import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import { Types } from "mongoose";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`faith-story-like:${session.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { id } = await params;
  const cleanedId = (id ?? "").replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  await dbConnect();
  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const alreadyLiked = (story.likedBy ?? []).some((id) => id.toString() === userId);

  const update = alreadyLiked
    ? { $pull: { likedBy: userId } }
    : { $addToSet: { likedBy: userId } };

  const updated = await FaithStoryModel.findByIdAndUpdate(cleanedId, update, {
    new: true,
    select: "likedBy",
  });

  const count = updated?.likedBy?.length ?? story.likedBy?.length ?? 0;

  return NextResponse.json({ liked: !alreadyLiked, count });
}
