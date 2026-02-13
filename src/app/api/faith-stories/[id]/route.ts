import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import { Types } from "mongoose";
import { z } from "zod";
import crypto from "crypto";
import { revalidateTag } from "next/cache";
import NotificationModel from "@/models/Notification";
import ModerationLogModel from "@/models/ModerationLog";
import { isAdminEmail } from "@/lib/admin";
import sanitizeHtml from "sanitize-html";

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

const normalizeId = (raw: string) => raw.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
const ADMIN_REASONS = ["Off-topic", "Inappropriate", "Spam", "Asking money"] as const;
const isAdminReason = (value: string): value is (typeof ADMIN_REASONS)[number] =>
  ADMIN_REASONS.includes(value as (typeof ADMIN_REASONS)[number]);

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  const StorySchema = z.object({
    title: z.string().trim().min(1).max(160),
    content: z.string().trim().min(1).max(50000),
    coverImage: z.string().url().optional().or(z.literal("")),
  });

  const body = StorySchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid story data" }, { status: 400 });
  }

  await dbConnect();

  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (!story.userId || story.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextCover =
    typeof body.data.coverImage === "string" && body.data.coverImage.trim()
      ? body.data.coverImage.trim()
      : null;

  const previousCover = story.coverImage ?? null;
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

  story.title = body.data.title.trim();
  story.content = sanitizedContent;
  if (nextCover) {
    story.coverImage = nextCover;
  }
  await story.save();

  if (nextCover && previousCover && previousCover !== nextCover) {
    const publicId = extractCloudinaryPublicId(previousCover);
    if (publicId) {
      await destroyCloudinaryImage(publicId);
    }
  }

  revalidateTag("faith-stories", "max");
  return NextResponse.json({ ok: true, title: story.title, content: story.content });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const cleanedId = normalizeId(id ?? "");
  if (!Types.ObjectId.isValid(cleanedId)) {
    return NextResponse.json({ error: "Invalid story ID" }, { status: 400 });
  }

  await dbConnect();
  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  const isOwner = story.userId && story.userId.toString() === session.user.id;
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (isAdmin && !isOwner && !reason) {
    return NextResponse.json({ error: "Moderation reason is required" }, { status: 400 });
  }

  await story.deleteOne();
  if (story.coverImage) {
    const publicId = extractCloudinaryPublicId(story.coverImage);
    if (publicId) {
      await destroyCloudinaryImage(publicId);
    }
  }
  if (isAdmin && reason && story.userId) {
    await ModerationLogModel.create({
      targetType: "faith_story",
      targetId: story._id,
      authorId: story.userId,
      moderatorId: session.user.id,
      reason,
    });
    if (story.userId.toString() !== session.user.id) {
      await NotificationModel.create({
        userId: story.userId,
        actorId: session.user.id,
        faithStoryId: story._id,
        type: "moderation",
        moderationReason: reason,
        moderationTarget: "faith_story",
      });
    }
  }
  revalidateTag("faith-stories", "max");
  return NextResponse.json({ ok: true });
}
