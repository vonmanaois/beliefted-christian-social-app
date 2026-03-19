import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import DayStoryModel from "@/models/DayStory";
import DayStoryViewModel from "@/models/DayStoryView";
import UserModel from "@/models/User";
import { rateLimit } from "@/lib/rateLimit";
import { cleanupExpiredDayStories } from "@/lib/dayStoriesCleanup";

const CreateSchema = z.object({
  imageUrl: z.string().url(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ? String(session.user.id) : null;
  const now = new Date();

  await cleanupExpiredDayStories();

  const stories = await DayStoryModel.find({ expiresAt: { $gt: now } })
    .sort({ createdAt: -1 })
    .lean();

  const userIds = Array.from(new Set(stories.map((story) => String(story.userId))));
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

  const storyIds = stories.map((story) => story._id);
  const viewCounts = storyIds.length
    ? await DayStoryViewModel.aggregate<{ _id: string; count: number }>([
        { $match: { storyId: { $in: storyIds } } },
        { $group: { _id: { $toString: "$storyId" }, count: { $sum: 1 } } },
      ])
    : [];
  const viewMap = new Map(viewCounts.map((item: { _id: string; count: number }) => [String(item._id), item.count]));

  const viewerMap = new Set<string>();
  if (viewerId && storyIds.length) {
    const views = await DayStoryViewModel.find({ storyId: { $in: storyIds }, userId: viewerId })
      .select("storyId")
      .lean();
    views.forEach((view: { storyId: unknown }) => viewerMap.add(String(view.storyId)));
  }

  const items = stories.map((story) => {
    const likedBy = Array.isArray(story.likedBy) ? story.likedBy : [];
    const storyId = String(story._id);
    return {
      _id: storyId,
      userId: String(story.userId),
      imageUrl: story.imageUrl,
      createdAt: story.createdAt,
      expiresAt: story.expiresAt,
      user: userMap.get(String(story.userId)) ?? null,
      isOwner: viewerId ? String(story.userId) === viewerId : false,
      viewCount: viewMap.get(storyId) ?? 0,
      hasViewed: viewerId ? viewerMap.has(storyId) : false,
      likeCount: likedBy.length,
      hasLiked: viewerId ? likedBy.some((id) => String(id) === viewerId) : false,
    };
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`day-story-post:${session.user.id}`, 4, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  await dbConnect();

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const story = await DayStoryModel.create({
    userId: session.user.id,
    imageUrl: body.data.imageUrl,
    expiresAt,
  });

  return NextResponse.json({ id: String(story._id) }, { status: 201 });
}
