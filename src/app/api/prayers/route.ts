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
  const followingOnly = searchParams.get("following") === "true";
  const reprayedOnly = searchParams.get("reprayed") === "true";
  const reprayedTargetId = userId ?? session?.user?.id ?? null;
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

  const loadPrayers = async (viewerId: string | null) => {
    const isOwnerView = Boolean(viewerId && userId && viewerId === userId);
    const conditions: Record<string, unknown>[] = [];

    if (userId && !reprayedOnly) {
      conditions.push({ userId });
      if (!isOwnerView) {
        conditions.push({ isAnonymous: false });
      }
    }
    if (followingOnly) {
      conditions.push({ userId: { $in: followingIds } });
    }
    if (reprayedOnly) {
      if (reprayedTargetId) {
        conditions.push({ prayedBy: reprayedTargetId });
      }
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
    const prayers = await PrayerModel.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const visible = prayers.filter((prayer) => {
      const rawUserId = (prayer as { userId?: unknown }).userId;
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

      const privacy = (prayer as { privacy?: string | null }).privacy ?? "public";
      if (privacy === "public") return true;
      if (!viewerId || !userIdString) return false;
      if (userIdString === viewerId) return true;
      if (privacy === "followers") {
        return followingIdSet.has(userIdString);
      }
      return false;
    });

    const hasMore = visible.length > limit;
    const items = hasMore ? visible.slice(0, limit) : visible;

    const userIds = items
      .filter((prayer) => !prayer.isAnonymous && prayer.userId)
      .map((prayer) => String(prayer.userId));
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
          content: typeof prayer.content === "string" ? prayer.content : "",
          _id: prayer._id.toString(),
          userId: userIdString,
          scriptureRef: prayer.scriptureRef ?? null,
          isOwner: Boolean(viewerId && userIdString && viewerId === userIdString),
        };

        const commentCount = await CommentModel.countDocuments({
          prayerId: prayer._id,
        });

        const privacy = (prayer as { privacy?: string | null }).privacy ?? "public";
        const isOwner = Boolean(viewerId && userIdString && viewerId === userIdString);
        const user =
          userMap.get(userIdString ?? "") ?? {
            name: prayer.authorName,
            image: prayer.authorImage,
            username: prayer.authorUsername,
            followers: [],
          };
        const isFollower = Boolean(viewerId && followingIdSet.has(String(userIdString)));
        const isVisible =
          privacy === "public" ||
          !privacy ||
          isOwner ||
          (privacy === "followers" && isFollower);

        if (!isVisible) {
          return null;
        }

        if (prayer.isAnonymous) {
          return { ...base, user: null, commentCount, isOwner };
        }

        return { ...base, user, commentCount, isOwner };
      })
    );
    const filtered = sanitized.filter((item) => item !== null);

    const last = items[items.length - 1];
    const nextCursor = hasMore && last
      ? Buffer.from(`${new Date(last.createdAt).toISOString()}|${last._id.toString()}`).toString("base64")
      : null;

    return { items: filtered, nextCursor };
  };

  if (!session?.user?.id && !userId && !followingOnly && !reprayedOnly) {
    const cached = unstable_cache(
      () => loadPrayers(null),
      ["prayers-feed", cursor ?? "start", String(limit)],
      { revalidate: 10, tags: ["prayers-feed"] }
    );
    return NextResponse.json(await cached());
  }

  if (reprayedOnly && !reprayedTargetId) {
    return NextResponse.json({ error: "User is required" }, { status: 400 });
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
    kind: z.enum(["prayer", "request"]).optional(),
    content: z.string().trim().max(2000).optional().or(z.literal("")),
    heading: z.string().trim().max(120).optional().or(z.literal("")),
    prayerPoints: z
      .array(
        z.object({
          title: z.string().trim().max(120),
          description: z.string().trim().max(400),
        })
      )
      .max(8)
      .optional(),
    scriptureRef: z.string().trim().max(80).optional().or(z.literal("")),
    isAnonymous: z.boolean().optional(),
    privacy: z.enum(["public", "followers", "private"]).optional(),
    expiresInDays: z.union([z.literal(7), z.literal(30), z.literal("never")]).optional(),
  });

  const body = PrayerSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: body.error.issues[0]?.message ?? "Invalid prayer data" },
      { status: 400 }
    );
  }

  const kind = body.data.kind ?? "prayer";
  const content = (body.data.content ?? "").trim();
  const heading = (body.data.heading ?? "").trim();
  const scriptureRef = (body.data.scriptureRef ?? "").trim();
  const prayerPoints = (body.data.prayerPoints ?? []).filter(
    (point) => point.title.trim() && point.description.trim()
  );
  const isAnonymous = Boolean(body.data.isAnonymous);
  const expiresInDays = body.data.expiresInDays ?? 7;
  const privacy = body.data.privacy ?? "public";

  if (kind === "prayer" && !content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (kind === "request" && prayerPoints.length === 0) {
    return NextResponse.json(
      { error: "Add at least one prayer point (title + description)" },
      { status: 400 }
    );
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
    content: kind === "request" ? "" : content,
    kind,
    userId: session.user.id,
    authorName: author?.name ?? null,
    authorUsername: author?.username ?? null,
    authorImage: author?.image ?? null,
    heading,
    prayerPoints,
    scriptureRef: scriptureRef || undefined,
    isAnonymous,
    privacy,
    prayedBy: [],
    expiresAt,
  });

  revalidateTag("prayers-feed", "max");
  return NextResponse.json(prayer, { status: 201 });
}
