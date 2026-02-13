import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";
import ModerationLogModel from "@/models/ModerationLog";
import { isAdminEmail } from "@/lib/admin";
import { revalidateTag } from "next/cache";
import crypto from "crypto";

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
