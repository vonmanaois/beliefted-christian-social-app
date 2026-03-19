import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import DayStoryModel from "@/models/DayStory";
import DayStoryViewModel from "@/models/DayStoryView";
import UserModel from "@/models/User";

export async function GET(
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

  const story = await DayStoryModel.findById(id).select("userId expiresAt").lean();
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }
  if (String(story.userId) !== String(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (story.expiresAt && story.expiresAt.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Story expired" }, { status: 410 });
  }

  const views = await DayStoryViewModel.find({ storyId: story._id })
    .sort({ createdAt: -1 })
    .select("userId createdAt")
    .lean();
  const userIds = Array.from(new Set(views.map((view) => String(view.userId))));
  const users = userIds.length
    ? await UserModel.find({ _id: { $in: userIds } })
        .select("name username image")
        .lean()
    : [];
  const userMap = new Map(
    users.map((user) => [
      String(user._id),
      { name: user.name ?? "User", username: user.username ?? null, image: user.image ?? null },
    ])
  );

  const items = views.map((view) => ({
    user: userMap.get(String(view.userId)) ?? null,
    viewedAt: view.createdAt,
  }));

  return NextResponse.json(items);
}
