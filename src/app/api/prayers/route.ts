import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import CommentModel from "@/models/Comment";
import PrayerModel from "@/models/Prayer";
import UserModel from "@/models/User";
import { Types } from "mongoose";
import { revalidateTag, unstable_cache } from "next/cache";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  const cursor = searchParams.get("cursor");
  const limitParam = Number(searchParams.get("limit") ?? 20);
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 50) : 20;

  await dbConnect();

  const loadPrayers = async (viewerId: string | null) => {
    const isOwnerView = Boolean(viewerId && userId && viewerId === userId);
    const conditions: Record<string, unknown>[] = [];

    if (userId) {
      conditions.push({ userId });
      if (!isOwnerView) {
        conditions.push({ isAnonymous: false });
      }
    }

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
    const prayers = await PrayerModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = prayers.length > limit;
    const items = hasMore ? prayers.slice(0, limit) : prayers;

    const userIds = items
      .filter((prayer) => !prayer.isAnonymous && prayer.userId)
      .map((prayer) => String(prayer.userId));
    const uniqueUserIds = Array.from(new Set(userIds));
    const users = uniqueUserIds.length
      ? await UserModel.find({ _id: { $in: uniqueUserIds } })
          .select("name image username")
          .lean()
      : [];
    const userMap = new Map(
      users.map((user) => [String(user._id), { name: user.name, image: user.image, username: user.username }])
    );

    const sanitized = await Promise.all(
      items.map(async (prayer) => {
        const rawUserId = (prayer as {
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

        const base = {
          ...prayer,
          _id: prayer._id.toString(),
          userId: userIdString,
          isOwner: Boolean(viewerId && userIdString && viewerId === userIdString),
        };

        const commentCount = await CommentModel.countDocuments({
          prayerId: prayer._id,
        });

        if (prayer.isAnonymous) {
          return { ...base, user: null, commentCount };
        }

        const user =
          userMap.get(userIdString ?? "") ?? {
            name: prayer.authorName,
            image: prayer.authorImage,
            username: prayer.authorUsername,
          };

        return { ...base, user, commentCount };
      })
    );

    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(`${new Date(last.createdAt).toISOString()}|${last._id.toString()}`).toString("base64")
      : null;

    return { items: sanitized, nextCursor };
  };

  if (!session?.user?.id && !userId) {
    const cached = unstable_cache(
      () => loadPrayers(null),
      ["prayers-feed", cursor ?? "start", String(limit)],
      { revalidate: 10, tags: ["prayers-feed"] }
    );
    return NextResponse.json(await cached());
  }

  return NextResponse.json(await loadPrayers(session?.user?.id ?? null));
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`prayer-post:${session.user.id}`, 5, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const PrayerSchema = z.object({
    content: z.string().trim().min(1).max(2000),
    isAnonymous: z.boolean().optional(),
    expiresInDays: z.union([z.literal(7), z.literal(30), z.literal("never")]).optional(),
  });

  const body = PrayerSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid prayer data" }, { status: 400 });
  }

  const content = body.data.content.trim();
  const isAnonymous = Boolean(body.data.isAnonymous);
  const expiresInDays = body.data.expiresInDays ?? 7;

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  let expiresAt: Date | undefined;
  if (expiresInDays !== "never") {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
  }

  await dbConnect();

  const author = await UserModel.findById(session.user.id)
    .select("name image username")
    .lean();

  const prayer = await PrayerModel.create({
    content,
    userId: session.user.id,
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    authorImage: author?.image ?? null,
    isAnonymous,
    prayedBy: [],
    expiresAt,
  });

  revalidateTag("prayers-feed");
  return NextResponse.json(prayer, { status: 201 });
}
