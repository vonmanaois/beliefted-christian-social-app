import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import FaithStoryModel from "@/models/FaithStory";
import CommentModel from "@/models/Comment";
import WordCommentModel from "@/models/WordComment";
import { Types } from "mongoose";

type FollowingItem =
  | { type: "word"; word: Record<string, unknown> }
  | { type: "prayer"; prayer: Record<string, unknown> };

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limitParam = Number(searchParams.get("limit") ?? 6);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 6;

  await dbConnect();

  const currentUser = await UserModel.findById(session.user.id)
    .select("following")
    .lean();
  const rawFollowing = Array.isArray(currentUser?.following) ? currentUser.following : [];
  const followingIds = rawFollowing
    .map((id) => (typeof id === "string" ? new Types.ObjectId(id) : id))
    .filter(Boolean);

  if (followingIds.length === 0) {
    return NextResponse.json({ items: [], nextCursor: null });
  }

  let cursorDate: Date | null = null;
  let cursorId: Types.ObjectId | null = null;
  if (cursor) {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAtRaw, idRaw] = decoded.split("|");
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
    const parsedId = idRaw && Types.ObjectId.isValid(idRaw) ? new Types.ObjectId(idRaw) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      cursorDate = createdAt;
      cursorId = parsedId;
    }
  }

  const buildCursorFilter = () => {
    if (!cursorDate) return {};
    return {
      $or: [
        { createdAt: { $lt: cursorDate } },
        ...(cursorId ? [{ createdAt: cursorDate, _id: { $lt: cursorId } }] : []),
      ],
    };
  };

  const cursorFilter = buildCursorFilter();

  const [words, prayers] = await Promise.all([
    WordModel.find({
      userId: { $in: followingIds },
      privacy: { $ne: "private" },
      ...cursorFilter,
    })
      .select(
        "content userId authorName authorUsername authorImage scriptureRef images imageOrientations sharedFaithStoryId sharedFaithStoryTitle sharedFaithStoryCover sharedFaithStoryAuthorUsername privacy likedBy savedBy createdAt"
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean(),
    PrayerModel.find({
      userId: { $in: followingIds },
      privacy: { $ne: "private" },
      ...cursorFilter,
      isAnonymous: false,
    })
      .select(
        "content userId authorName authorUsername authorImage kind heading prayerPoints scriptureRef isAnonymous privacy prayedBy createdAt expiresAt"
      )
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean(),
  ]);

  const combined = [
    ...words.map((word) => ({ type: "word" as const, data: word })),
    ...prayers.map((prayer) => ({ type: "prayer" as const, data: prayer })),
  ].sort((a, b) => {
    const aDate = new Date(a.data.createdAt as Date).getTime();
    const bDate = new Date(b.data.createdAt as Date).getTime();
    if (aDate !== bDate) return bDate - aDate;
    return String(b.data._id).localeCompare(String(a.data._id));
  });

  const sliced = combined.slice(0, limit + 1);
  const pageItems = sliced.slice(0, limit);

  const sharedStoryIds = pageItems
    .filter((item) => item.type === "word")
    .map((item) => (item.data as { sharedFaithStoryId?: unknown }).sharedFaithStoryId)
    .filter((id): id is Types.ObjectId | string => Boolean(id))
    .map((id) => String(id));
  const uniqueSharedStoryIds = Array.from(new Set(sharedStoryIds));
  const sharedStories = uniqueSharedStoryIds.length
    ? await FaithStoryModel.find({ _id: { $in: uniqueSharedStoryIds } })
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

  const userIds = pageItems
    .map((item) => String(item.data.userId))
    .filter(Boolean);
  const uniqueUserIds = Array.from(new Set(userIds));
  const users = uniqueUserIds.length
    ? await UserModel.find({ _id: { $in: uniqueUserIds } })
        .select("name image username")
        .lean()
    : [];
  const userMap = new Map(
    users.map((user) => [String(user._id), { name: user.name, image: user.image, username: user.username }])
  );

  const wordIds = pageItems
    .filter((item) => item.type === "word")
    .map((item) => item.data._id);
  const prayerIds = pageItems
    .filter((item) => item.type === "prayer")
    .map((item) => item.data._id);
  const [wordCommentCounts, prayerCommentCounts] = await Promise.all([
    wordIds.length
      ? WordCommentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { wordId: { $in: wordIds } } },
          { $group: { _id: "$wordId", count: { $sum: 1 } } },
        ])
      : [],
    prayerIds.length
      ? CommentModel.aggregate<{ _id: Types.ObjectId; count: number }>([
          { $match: { prayerId: { $in: prayerIds } } },
          { $group: { _id: "$prayerId", count: { $sum: 1 } } },
        ])
      : [],
  ]);
  const wordCommentMap = new Map(
    wordCommentCounts.map((entry) => [String(entry._id), entry.count])
  );
  const prayerCommentMap = new Map(
    prayerCommentCounts.map((entry) => [String(entry._id), entry.count])
  );

  const items: FollowingItem[] = await Promise.all(
    pageItems.map(async (item) => {
      if (item.type === "word") {
        const word = item.data;
        const user = userMap.get(String(word.userId)) ?? {
          name: word.authorName,
          image: word.authorImage,
          username: word.authorUsername,
        };
        const commentCount = wordCommentMap.get(String(word._id)) ?? 0;
        const sharedStoryId = word.sharedFaithStoryId
          ? String(word.sharedFaithStoryId)
          : null;
        const fallbackShared =
          sharedStoryId && sharedStoryMap.has(sharedStoryId)
            ? sharedStoryMap.get(sharedStoryId) ?? null
            : null;
        return {
          type: "word",
          word: {
            ...word,
            _id: word._id.toString(),
            user,
            commentCount,
            userId: String(word.userId),
            sharedFaithStoryId: sharedStoryId,
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
          },
        };
      }

      const prayer = item.data;
      const user = userMap.get(String(prayer.userId)) ?? {
        name: prayer.authorName,
        image: prayer.authorImage,
        username: prayer.authorUsername,
      };
      const commentCount = prayerCommentMap.get(String(prayer._id)) ?? 0;
      const prayedBy = Array.isArray(prayer.prayedBy)
        ? prayer.prayedBy.map((id: unknown) => String(id))
        : [];
      return {
        type: "prayer",
        prayer: {
          ...prayer,
          _id: prayer._id.toString(),
          user,
          commentCount,
          userId: String(prayer.userId),
          prayedBy,
          isAnonymous: false,
        },
      };
    })
  );

  const last = pageItems[pageItems.length - 1];
  const nextCursor =
    sliced.length > limit && last
      ? Buffer.from(`${new Date(last.data.createdAt as Date).toISOString()}|${String(last.data._id)}`).toString(
          "base64"
        )
      : null;

  return NextResponse.json({ items, nextCursor });
}
