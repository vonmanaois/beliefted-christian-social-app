import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import PrayerModel from "@/models/Prayer";
import CommentModel from "@/models/Comment";
import UserModel from "@/models/User";
import NotificationModel from "@/models/Notification";
import ModerationLogModel from "@/models/ModerationLog";
import { isAdminEmail } from "@/lib/admin";
import { revalidateTag } from "next/cache";

const ADMIN_REASONS = ["Off-topic", "Inappropriate", "Spam", "Asking money"] as const;
const isAdminReason = (value: string): value is (typeof ADMIN_REASONS)[number] =>
  ADMIN_REASONS.includes(value as (typeof ADMIN_REASONS)[number]);

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = isAdminEmail(session.user.email ?? null);
  let reason: (typeof ADMIN_REASONS)[number] | null = null;
  if (isAdmin) {
    try {
      const body = (await req.json()) as { reason?: string };
      if (body?.reason && isAdminReason(body.reason)) {
        reason = body.reason;
      }
    } catch {
      // ignore missing body
    }
  }

  await dbConnect();

  const prayer = await PrayerModel.findById(id);
  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  const isOwner = prayer.userId && prayer.userId.toString() === session.user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isAdmin && !isOwner && !reason) {
    return NextResponse.json({ error: "Moderation reason is required" }, { status: 400 });
  }

  await CommentModel.deleteMany({ prayerId: prayer._id });
  await PrayerModel.deleteOne({ _id: prayer._id });

  if (isAdmin && reason && prayer.userId) {
    await ModerationLogModel.create({
      targetType: "prayer",
      targetId: prayer._id,
      authorId: prayer.userId,
      moderatorId: session.user.id,
      reason,
    });
    if (prayer.userId.toString() !== session.user.id) {
      await NotificationModel.create({
        userId: prayer.userId,
        actorId: session.user.id,
        prayerId: prayer._id,
        type: "moderation",
        moderationReason: reason,
        moderationTarget: "prayer",
      });
    }
  }

  revalidateTag("prayers-feed", "max");
  return NextResponse.json({ ok: true });
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  const viewerId = session?.user?.id ?? null;

  await dbConnect();

  const prayer = await PrayerModel.findById(id).lean();
  if (!prayer) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const privacy = prayer.privacy ?? "public";
  if (privacy !== "public") {
    if (!viewerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (String(prayer.userId) !== String(viewerId)) {
      if (privacy === "followers") {
        const viewer = await UserModel.findById(viewerId).select("following").lean();
        const following = Array.isArray(viewer?.following) ? viewer.following : [];
        const allowed = following.some((value) => String(value) === String(prayer.userId));
        if (!allowed) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const commentCount = await CommentModel.countDocuments({ prayerId: prayer._id });
  const user = prayer.isAnonymous
    ? null
    : await UserModel.findById(prayer.userId).select("name image username").lean();
  const isOwner = Boolean(viewerId && String(prayer.userId) === String(viewerId));

  return NextResponse.json({
    ...prayer,
    _id: String(prayer._id),
    userId: prayer.userId ? String(prayer.userId) : undefined,
    createdAt:
      prayer.createdAt instanceof Date
        ? prayer.createdAt.toISOString()
        : (prayer.createdAt as unknown as string),
    prayedBy: Array.isArray(prayer.prayedBy)
      ? prayer.prayedBy.map((v) => String(v))
      : [],
    commentCount,
    isOwner,
    privacy: (privacy === "followers" || privacy === "private"
      ? privacy
      : "public") as "public" | "followers" | "private",
    user: prayer.isAnonymous
      ? null
      : {
          name: user?.name ?? null,
          image: user?.image ?? null,
          username: user?.username ?? null,
        },
  });
}

export async function PUT(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  await dbConnect();

  const prayer = await PrayerModel.findById(id);
  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  if (!prayer.userId || prayer.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (prayer.kind === "request") {
    const rawPoints = Array.isArray(body.prayerPoints) ? body.prayerPoints : [];
    const cleanedPoints = rawPoints
      .map((point: { title?: unknown; description?: unknown } | null) => ({
        title: typeof point?.title === "string" ? point.title.trim() : "",
        description:
          typeof point?.description === "string" ? point.description.trim() : "",
      }))
      .filter((point: { title: string; description: string }) => point.title && point.description)
      .slice(0, 8);

    if (cleanedPoints.length === 0) {
      return NextResponse.json(
        { error: "Add at least one prayer point (title + description)" },
        { status: 400 }
      );
    }

    prayer.prayerPoints = cleanedPoints;
    prayer.content = "";
    await prayer.save();

    revalidateTag("prayers-feed", "max");
    return NextResponse.json({ ok: true, prayerPoints: prayer.prayerPoints });
  }

  const content = typeof body.content === "string" ? body.content.trim() : "";
  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  prayer.content = content;
  await prayer.save();

  revalidateTag("prayers-feed", "max");
  return NextResponse.json({ ok: true, content: prayer.content });
}
