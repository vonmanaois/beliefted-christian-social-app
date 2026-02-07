import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";
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

  const filter: Record<string, unknown> = userId ? { userId } : {};

  if (cursor) {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAtRaw, idRaw] = decoded.split("|");
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
    const cursorId = idRaw && Types.ObjectId.isValid(idRaw) ? new Types.ObjectId(idRaw) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      filter.$or = [
        { createdAt: { $lt: createdAt } },
        ...(cursorId ? [{ createdAt, _id: { $lt: cursorId } }] : []),
      ];
    }
  }

  if (cursor) {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAtRaw, idRaw] = decoded.split("|");
    const createdAt = createdAtRaw ? new Date(createdAtRaw) : null;
    const cursorId = idRaw && Types.ObjectId.isValid(idRaw) ? new Types.ObjectId(idRaw) : null;
    if (createdAt && !Number.isNaN(createdAt.getTime())) {
      filter.$or = [
        { createdAt: { $lt: createdAt } },
        ...(cursorId ? [{ createdAt, _id: { $lt: cursorId } }] : []),
      ];
    }
  }

  const loadWords = async (viewerId: string | null) => {
    const words = await WordModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .populate("userId", "name image username")
      .lean();

    const hasMore = words.length > limit;
    const items = hasMore ? words.slice(0, limit) : words;

    const sanitized = await Promise.all(
      items.map(async (word) => {
        const { userId: author, ...rest } = word as typeof word & {
          userId?: { name?: string; image?: string; username?: string; _id?: { toString: () => string } } | null;
        };

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
        return {
          ...rest,
          _id: word._id.toString(),
          user: author ?? null,
          commentCount,
          userId: userIdString,
          isOwner: Boolean(viewerId && userIdString && viewerId === userIdString),
        };
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
    content: z.string().trim().min(1).max(2000),
  });

  const body = WordSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid word data" }, { status: 400 });
  }

  const content = body.data.content.trim();

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await dbConnect();

  const word = await WordModel.create({
    content,
    userId: session.user.id,
  });

  revalidateTag("words-feed");
  return NextResponse.json(word, { status: 201 });
}
