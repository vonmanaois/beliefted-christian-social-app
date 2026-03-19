import crypto from "crypto";
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
    const versionIndex = parts.findIndex((part) => /^v\d+$/.test(part));
    const publicIdParts = versionIndex >= 0 ? parts.slice(versionIndex + 1) : parts;
    if (publicIdParts.length === 0) return null;
    const filename = publicIdParts.join("/");
    return filename.replace(/\.[^.]+$/, "");
  } catch {
    return null;
  }
};

const destroyCloudinaryImage = async (url: string | null) => {
  if (!url) return false;
  const publicId = extractCloudinaryPublicId(url);
  if (!publicId) return false;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return false;

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

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`, {
    method: "POST",
    body: params,
  });

  return response.ok;
};

export async function cleanupExpiredDayStories() {
  await dbConnect();

  const now = new Date();
  const expired = await DayStoryModel.find({ expiresAt: { $lte: now } })
    .select("_id imageUrl")
    .lean();

  if (!expired.length) {
    return { deletedStories: 0, deletedAssets: 0 };
  }

  const expiredIds = expired.map((story) => story._id);
  await DayStoryViewModel.deleteMany({ storyId: { $in: expiredIds } });
  await DayStoryModel.deleteMany({ _id: { $in: expiredIds } });

  const assetResults = await Promise.all(
    expired.map((story) => destroyCloudinaryImage(story.imageUrl ?? null))
  );

  return {
    deletedStories: expired.length,
    deletedAssets: assetResults.filter(Boolean).length,
  };
}
