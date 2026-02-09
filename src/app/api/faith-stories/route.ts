import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import FaithStoryCommentModel from "@/models/FaithStoryComment";
import UserModel from "@/models/User";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();

  await dbConnect();

  const filter =
    query.length > 0
      ? { $text: { $search: query } }
      : {};

  const stories = await FaithStoryModel.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(100)
    .lean();

  const userIds = stories
    .filter((story) => story.userId)
    .map((story) => String(story.userId));
  const uniqueUserIds = Array.from(new Set(userIds));
  const users = uniqueUserIds.length
    ? await UserModel.find({ _id: { $in: uniqueUserIds } })
        .select("name image username")
        .lean()
    : [];
  const userMap = new Map(
    users.map((user) => [String(user._id), { name: user.name, image: user.image, username: user.username }])
  );

  const items = await Promise.all(
    stories.map(async (story) => {
      const userIdString = story.userId ? String(story.userId) : null;
      const commentCount = await FaithStoryCommentModel.countDocuments({
        storyId: story._id,
      });
      const user =
        story.isAnonymous
          ? { name: "Anonymous", image: null, username: null }
          : userMap.get(userIdString ?? "") ?? {
              name: story.authorName,
              image: story.authorImage,
              username: story.authorUsername,
            };

      return {
        ...story,
        _id: story._id.toString(),
        userId: userIdString,
        user,
        commentCount,
      };
    })
  );

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`faith-story-post:${session.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const StorySchema = z.object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(10000),
    isAnonymous: z.boolean().optional(),
  });

  const body = StorySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid story data" }, { status: 400 });
  }

  await dbConnect();

  const author = await UserModel.findById(session.user.id)
    .select("name image username")
    .lean();
  const isAnonymous = Boolean(body.data.isAnonymous);

  const story = await FaithStoryModel.create({
    title: body.data.title.trim(),
    content: body.data.content.trim(),
    userId: session.user.id,
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    authorImage: author?.image ?? null,
    isAnonymous,
    likedBy: [],
  });

  return NextResponse.json(story, { status: 201 });
}
