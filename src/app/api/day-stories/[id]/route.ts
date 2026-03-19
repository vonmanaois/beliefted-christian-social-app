import { NextResponse } from "next/server";
import { Types } from "mongoose";
import crypto from "crypto";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import DayStoryModel from "@/models/DayStory";
import DayStoryViewModel from "@/models/DayStoryView";

const extractCloudinaryPublicId = (url: string) => {
  try {
    const cleanUrl = url.split("?")[0] ?? url;
    const uploadIndex = cleanUrl.indexOf("/upload/");
    if (uploadIndex === -1) return null;
    const afterUpload = cleanUrl.slice(uploadIndex + "/upload/".length);
    const parts = afterUpload.split("/");
    const versionIndex = parts.findIndex((part) => /^v\\d+$/.test(part));
    const publicIdParts = versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts;
    if (publicIdParts.length === 0) return null;
    const filename = publicIdParts.join("/");
    return filename.replace(/\\.[^.]+$/, "");
  } catch {
    return null;
  }
};

const destroyCloudinaryImage = async (url: string | null) => {
  if (!url) return;
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return;
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid story id" }, { status: 400 });
  }

  await dbConnect();

  const story = await DayStoryModel.findById(id);
  if (!story) {
    return NextResponse.json({ error: "Story not found" }, { status: 404 });
  }

  if (String(story.userId) !== String(session.user.id)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await DayStoryViewModel.deleteMany({ storyId: story._id });
  await DayStoryModel.deleteOne({ _id: story._id });
  await destroyCloudinaryImage(story.imageUrl ?? null);

  return NextResponse.json({ ok: true });
}
