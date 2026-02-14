import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";
import UserModel from "@/models/User";
import FaithStoryModel from "@/models/FaithStory";
import { Types } from "mongoose";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { notifyMentions } from "@/lib/mentionNotifications";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const cursor = searchParams.get("cursor");
  const followingOnly = searchParams.get("following") === "true";
  const savedOnly = searchParams.get("saved") === "true";
  const limitParam = Number(searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 6;

  await dbConnect();

  let followingIds: Types.ObjectId[] = [];
  if (session?.user?.id) {
    const currentUser = await UserModel.findById(session.user.id)
      .select("following")
      .lean();
    const rawFollowing = Array.isArray(currentUser?.following) ? currentUser.following : [];
    followingIds = rawFollowing
      .map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id))
      .filter(Boolean);
  } else if (followingOnly) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const followingIdSet = new Set(followingIds.map((id) => String(id)));

  if (savedOnly) {
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (userId && userId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const loadWords = async (viewerId: string | null) => {
    const conditions: Record<string, unknown>[] = [];
    if (userId && !savedOnly) {
      conditions.push({ userId });
    }
    if (followingOnly) {
      conditions.push({ userId: { $in: followingIds } });
    }
    if (savedOnly) {
      conditions.push({ savedBy: session?.user?.id });
    }

    const privacyOr = viewerId
      ? [
          { userId: viewerId },
          { privacy: "public" },
          { privacy: { $exists: false } },
          ...(followingIds.length
            ? [{ privacy: "followers", userId: { $in: followingIds } }]
            : []),
        ]
      : [{ privacy: "public" }, { privacy: { $exists: false } }];
    conditions.push({ $or: privacyOr });

    if (cursor) {
      const decoded = Buffer.from(cursor, "base64").toString("utf8");
      const [createdAtRaw, idRaw] = decoded.split("|");
      const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
      const cursorId = idRaw && Types.ObjectId.isValid(idRaw) ? new Types.ObjectId(idRaw) : null;
      if (createdAt && !Number.isNaN(createdAt.getTime())) {
        conditions.push({
          $or: [
            { createdAt: { $lt: createdAt } },
            ...(cursorId ? [{ createdAt, _id: { $lt: cursorId } }] : []),
          ],
        });
      }
    }
    const filter = conditions.length ? { $and: conditions } : {};
    const words = await WordModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = words.length > limit;
    const items = hasMore ? words.slice(0, limit) : words;

    const missingSharedIds = items
      .filter(
        (word) =>
          word.sharedFaithStoryId &&
          !word.sharedFaithStoryTitle
      )
      .map((word) => String(word.sharedFaithStoryId));
    const uniqueMissingSharedIds = Array.from(new Set(missingSharedIds));
    const sharedStories = uniqueMissingSharedIds.length
      ? await FaithStoryModel.find({ _id: { $in: uniqueMissingSharedIds } })
          .select("title coverImage authorUsername")
          .lean()
      : [];
    const sharedStoryMap = new Map(
      sharedStories.map((story) => [
        String(story._id),
        {
          title: story.title ?? "",
          coverImage: story.coverImage ?? null,
          authorUsername: story.authorUsername ?? null,
        },
      ])
    );

    const userIds = items
      .filter((word) => word.userId)
      .map((word) => String(word.userId));
    const uniqueUserIds = Array.from(new Set(userIds));
    const users = uniqueUserIds.length
      ? await UserModel.find({ _id: { $in: uniqueUserIds } })
          .select("name image username followers")
          .lean()
      : [];
    const userMap = new Map(
      users.map((user) => [
        String(user._id),
        {
          name: user.name,
          image: user.image,
          username: user.username,
          followers: Array.isArray(user.followers)
            ? user.followers.map((id) => String(id))
            : [],
        },
      ])
    );

    const sanitized = await Promise.all(
      items.map(async (word) => {
        const rawUserId = (word as {
          userId?: { _id?: { toString: () => string } } | { toString: () => string } | string | null;
        }).userId;
        let userIdString: string | null = null;
        if (typeof rawUserId === "string") {
          userIdString = rawUserId;
        } else if (
          rawUserId &&
          typeof (rawUserId as { _id?: { toString: () => string } })._id?.toString === "function"
        ) {
          userIdString = (rawUserId as { _id: { toString: () => string } })._id.toString();
        } else if (rawUserId && typeof (rawUserId as { toString?: () => string }).toString === "function") {
          const asString = (rawUserId as { toString: () => string }).toString();
          userIdString = asString !== "[object Object]" ? asString : null;
        }

        const commentCount = await WordCommentModel.countDocuments({
          wordId: word._id,
        });

        const user =
          userMap.get(userIdString ?? "") ?? {
            name: word.authorName,
            image: word.authorImage,
            username: word.authorUsername,
            followers: [],
          };
        const sharedStoryId = word.sharedFaithStoryId
          ? String(word.sharedFaithStoryId)
          : null;
        const fallbackShared =
          sharedStoryId && sharedStoryMap.has(sharedStoryId)
            ? sharedStoryMap.get(sharedStoryId) ?? null
            : null;

        const privacy = (word as { privacy?: string | null }).privacy ?? "public";
        const isOwner = Boolean(viewerId && userIdString && viewerId === userIdString);
        const isFollower = Boolean(viewerId && followingIdSet.has(String(userIdString)));
        const isVisible =
          privacy === "public" ||
          !privacy ||
          isOwner ||
          (privacy === "followers" && isFollower);

        return isVisible
          ? {
          ...word,
          _id: word._id.toString(),
          user,
          commentCount,
          userId: userIdString,
          sharedFaithStoryId: sharedStoryId,
          scriptureRef: word.scriptureRef ?? null,
          images: Array.isArray(word.images) ? word.images : [],
          sharedFaithStory:
            sharedStoryId &&
            (word.sharedFaithStoryTitle || fallbackShared)
              ? {
                  id: sharedStoryId,
                  title: word.sharedFaithStoryTitle ?? fallbackShared?.title ?? "",
                  coverImage:
                    word.sharedFaithStoryCover ??
                    fallbackShared?.coverImage ??
                    null,
                  authorUsername:
                    word.sharedFaithStoryAuthorUsername ??
                    fallbackShared?.authorUsername ??
                    null,
                }
              : null,
          savedBy: Array.isArray(word.savedBy)
            ? word.savedBy.map((id) => String(id))
            : [],
          isOwner,
        }
          : null;
      })
    );
    const filtered = sanitized.filter((item) => item !== null);

    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(`${new Date(last.createdAt).toISOString()}|${last._id.toString()}`).toString("base64")
      : null;

    return { items: filtered, nextCursor };
  };

  if (!session?.user?.id && !userId && !followingOnly && !savedOnly) {
    const cached = unstable_cache(
      () => loadWords(null),
      ["words-feed", cursor ?? "start", String(limit)],
      { revalidate: 10, tags: ["words-feed"] }
    );
    return NextResponse.json(await cached());
  }

  return NextResponse.json(await loadWords(session?.user?.id ?? null));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`word-post:${session.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const WordSchema = z.object({
    content: z.string().trim().max(2000).optional().or(z.literal("")),
    scriptureRef: z.string().trim().max(80).optional().or(z.literal("")),
    images: z.array(z.string().url()).max(3).optional(),
    sharedFaithStoryId: z.string().optional().or(z.literal("")),
    privacy: z.enum(["public", "followers", "private"]).optional(),
  });

  const body = WordSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid word data" }, { status: 400 });
  }

  const content = (body.data.content ?? "").trim();
  const scriptureRef = (body.data.scriptureRef ?? "").trim();
  const images = Array.isArray(body.data.images) ? body.data.images : [];
  const sharedFaithStoryId = (body.data.sharedFaithStoryId ?? "").trim();
  const privacy = body.data.privacy ?? "public";

  if (!content && images.length === 0 && !sharedFaithStoryId) {
    return NextResponse.json(
      { error: "Content, images, or a shared story is required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const author = await UserModel.findById(session.user.id)
    .select("name image username")
    .lean();

  let sharedStoryData:
    | {
        id: string;
        title: string;
        coverImage: string | null;
        authorUsername: string | null;
      }
    | null = null;

  if (sharedFaithStoryId) {
    const story = await FaithStoryModel.findById(sharedFaithStoryId)
      .select("title coverImage authorUsername")
      .lean();
    if (!story) {
      return NextResponse.json({ error: "Faith story not found" }, { status: 404 });
    }
    sharedStoryData = {
      id: story._id.toString(),
      title: story.title ?? "",
      coverImage: story.coverImage ?? null,
      authorUsername: story.authorUsername ?? null,
    };
  }

  const word = await WordModel.create({
    content,
    userId: session.user.id,
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    authorImage: author?.image ?? null,
    scriptureRef: scriptureRef || undefined,
    images,
    sharedFaithStoryId: sharedStoryData?.id ?? undefined,
    sharedFaithStoryTitle: sharedStoryData?.title ?? undefined,
    sharedFaithStoryCover: sharedStoryData?.coverImage ?? undefined,
    sharedFaithStoryAuthorUsername: sharedStoryData?.authorUsername ?? undefined,
    privacy,
  });

  if (sharedStoryData?.id) {
    await FaithStoryModel.updateOne(
      { _id: sharedStoryData.id },
      { $inc: { sharedCount: 1 } }
    );
  }

  await notifyMentions({
    text: content,
    actorId: session.user.id,
    wordId: word._id.toString(),
  });

  revalidateTag("words-feed", "max");
  return NextResponse.json(word, { status: 201 });
}
