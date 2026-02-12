import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FaithStoryModel from "@/models/FaithStory";
import { Types } from "mongoose";
import { z } from "zod";
import crypto from "crypto";
import { revalidateTag } from "next/cache";

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
    content: z.string().trim().min(1).max(10000),
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

  story.title = body.data.title.trim();
  story.content = body.data.content.trim();
  await story.save();

  revalidateTag("faith-stories", "max");
  return NextResponse.json({ ok: true, title: story.title, content: story.content });
}

export async function DELETE(
  _req: Request,
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

  await dbConnect();
  const story = await FaithStoryModel.findById(cleanedId);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (!story.userId || story.userId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await story.deleteOne();
  if (story.coverImage) {
    const publicId = extractCloudinaryPublicId(story.coverImage);
    if (publicId) {
      await destroyCloudinaryImage(publicId);
    }
  }
  revalidateTag("faith-stories", "max");
  return NextResponse.json({ ok: true });
}
