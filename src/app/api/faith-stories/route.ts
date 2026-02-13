import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import FaithStoryCommentModel from "@/models/FaithStoryComment";
import UserModel from "@/models/User";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { revalidateTag, unstable_cache } from "next/cache";
import sanitizeHtml from "sanitize-html";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = (searchParams.get("q") ?? "").trim();

  await dbConnect();

  const filter =
    query.length > 0
      ? { $text: { $search: query } }
      : {};

  const [meta] = await FaithStoryModel.aggregate<{
    count: number;
    latest: Date | null;
  }>([
    { $match: filter },
    { $group: { _id: null, count: { $sum: 1 }, latest: { $max: "$updatedAt" } } },
  ]);

  const count = meta?.count ?? 0;
  const latest = meta?.latest ? new Date(meta.latest).toISOString() : "0";
  const etag = `W/"faith-stories:${query || "all"}:${count}:${latest}"`;
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new NextResponse(null, {
      status: 304,
      headers: { ETag: etag },
    });
  }

  const loadStories = async () =>
    FaithStoryModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean();

  const stories =
    query.length > 0
      ? await loadStories()
      : await unstable_cache(
          () => loadStories(),
          ["faith-stories-list"],
          { revalidate: 300, tags: ["faith-stories"] }
        )();

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
        coverImage: story.coverImage ?? null,
      };
    })
  );

  return NextResponse.json(items, {
    headers: { ETag: etag },
  });
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
    content: z.string().trim().min(1).max(50000),
    isAnonymous: z.boolean().optional(),
    coverImage: z.string().url().optional(),
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

  const rawContent = body.data.content.trim();
  const decodedContent =
    rawContent.includes("&lt;") && !rawContent.includes("<")
      ? rawContent
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, "\"")
          .replace(/&#39;/g, "'")
      : rawContent;
  const sanitizedContent = sanitizeHtml(decodedContent, {
    allowedTags: [
      "p",
      "br",
      "strong",
      "em",
      "u",
      "s",
      "blockquote",
      "h2",
      "h3",
      "hr",
      "ul",
      "ol",
      "li",
      "img",
    ],
    allowedAttributes: {
      img: ["src", "alt", "title"],
    },
    allowedSchemes: ["http", "https"],
    allowedSchemesByTag: {
      img: ["http", "https"],
    },
  });
  const plainText = sanitizedContent
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!plainText) {
    return NextResponse.json({ error: "Story content is required" }, { status: 400 });
  }
  const inlineImages = sanitizedContent.match(/<img /g) ?? [];
  if (inlineImages.length > 2) {
    return NextResponse.json({ error: "You can add up to 2 images." }, { status: 400 });
  }

  const story = await FaithStoryModel.create({
    title: body.data.title.trim(),
    content: sanitizedContent,
    userId: session.user.id,
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    authorImage: author?.image ?? null,
    isAnonymous,
    coverImage: body.data.coverImage?.trim() || undefined,
    likedBy: [],
  });

  revalidateTag("faith-stories", "max");
  return NextResponse.json(story, { status: 201 });
}
