import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";
import ModerationLogModel from "@/models/ModerationLog";
import FaithStoryModel from "@/models/FaithStory";
import { isAdminEmail } from "@/lib/admin";
import { revalidateTag } from "next/cache";
import crypto from "crypto";
import UserModel from "@/models/User";

const extractCloudinaryPublicId = (url: string) => {
  try {
    const cleanUrl = url.split("?")[0] ?? url;
    const uploadIndex = cleanUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;
    const afterUpload = cleanUrl.slice(uploadIndex + "/upload/".length);
    const parts = afterUpload.split("/");
    const versionIndex = parts.findIndex((part) => /^v\\d+$/.test(part));
    const publicIdParts =
      versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts;
    if (publicIdParts.length === 0) return null;
    const filename = publicIdParts.join("/");
    return filename.replace(/\\.[^.]+$/, "");
  } catch {
    return null;
  }
};

const destroyCloudinaryImage = async (publicId: string) => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signatureBase = `public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  const params = new URLSearchParams({
    public_id: publicId,
    api_key: apiKey,
    timestamp: String(timestamp),
    signature,
  });

  await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: params,
  });
};

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

  const word = await WordModel.findById(id);
  if (!word) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const isOwner = word.userId && word.userId.toString() === session.user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isAdmin && !isOwner && !reason) {
    return NextResponse.json({ error: "Moderation reason is required" }, { status: 400 });
  }

  await WordCommentModel.deleteMany({ wordId: word._id });
  await WordModel.deleteOne({ _id: word._id });
  if (word.sharedFaithStoryId) {
    await FaithStoryModel.updateOne(
      { _id: word.sharedFaithStoryId },
      [
        {
          $set: {
            sharedCount: {
              $max: [0, { $subtract: ["$sharedCount", 1] }],
            },
          },
        },
      ]
    );
  }

  const images = Array.isArray(word.images) ? word.images : [];
  await Promise.all(
    images.map(async (url) => {
      if (typeof url !== "string") return;
      if (!url.includes("res.cloudinary.com")) return;
      const publicId = extractCloudinaryPublicId(url);
      if (publicId) {
        await destroyCloudinaryImage(publicId);
      }
    })
  );

  if (isAdmin && reason && word.userId) {
    await ModerationLogModel.create({
      targetType: "word",
      targetId: word._id,
      authorId: word.userId,
      moderatorId: session.user.id,
      reason,
    });
    if (word.userId.toString() !== session.user.id) {
      await NotificationModel.create({
        userId: word.userId,
        actorId: session.user.id,
        wordId: word._id,
        type: "moderation",
        moderationReason: reason,
        moderationTarget: "word",
      });
    }
  }

  revalidateTag("words-feed", "max");
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

  const word = await WordModel.findById(id).lean();
  if (!word) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  const privacy = word.privacy ?? "public";
  if (privacy !== "public") {
    if (!viewerId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (String(word.userId) !== String(viewerId)) {
      if (privacy === "followers") {
        const viewer = await UserModel.findById(viewerId).select("following").lean();
        const following = Array.isArray(viewer?.following) ? viewer.following : [];
        const allowed = following.some((value) => String(value) === String(word.userId));
        if (!allowed) {
          return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }
  }

  const commentCount = await WordCommentModel.countDocuments({ wordId: word._id });
  const user = await UserModel.findById(word.userId)
    .select("name image username")
    .lean();
  const isOwner = Boolean(viewerId && String(word.userId) === String(viewerId));

  const sharedStoryId = word.sharedFaithStoryId
    ? String(word.sharedFaithStoryId)
    : null;
  let sharedStoryFallback: {
    title?: string | null;
    coverImage?: string | null;
    authorUsername?: string | null;
  } | null = null;
  if (
    sharedStoryId &&
    (!word.sharedFaithStoryTitle ||
      !word.sharedFaithStoryCover ||
      !word.sharedFaithStoryAuthorUsername)
  ) {
    sharedStoryFallback = await FaithStoryModel.findById(sharedStoryId)
      .select("title coverImage authorUsername")
      .lean();
  }
  const sharedFaithStory =
    sharedStoryId &&
    (word.sharedFaithStoryTitle || sharedStoryFallback)
      ? {
          id: sharedStoryId,
          title: word.sharedFaithStoryTitle ?? sharedStoryFallback?.title ?? "",
          coverImage:
            word.sharedFaithStoryCover ?? sharedStoryFallback?.coverImage ?? null,
          authorUsername:
            word.sharedFaithStoryAuthorUsername ??
            sharedStoryFallback?.authorUsername ??
            null,
        }
      : null;

  return NextResponse.json({
    ...word,
    _id: String(word._id),
    userId: word.userId ? String(word.userId) : undefined,
    createdAt:
      word.createdAt instanceof Date
        ? word.createdAt.toISOString()
        : (word.createdAt as unknown as string),
    likedBy: Array.isArray(word.likedBy) ? word.likedBy.map((v) => String(v)) : [],
    savedBy: Array.isArray(word.savedBy) ? word.savedBy.map((v) => String(v)) : [],
    commentCount,
    isOwner,
    privacy: (privacy === "followers" || privacy === "private"
      ? privacy
      : "public") as "public" | "followers" | "private",
    user: user
      ? {
          name: user.name ?? null,
          image: user.image ?? null,
          username: user.username ?? null,
        }
      : null,
    sharedFaithStory,
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
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await dbConnect();

  const word = await WordModel.findById(id);
  if (!word) {
    return NextResponse.json({ error: "Post not found" }, { status: 404 });
  }

  if (!word.userId || word.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  word.content = content;
  await word.save();

  revalidateTag("words-feed", "max");
  return NextResponse.json({ ok: true, content: word.content });
}
