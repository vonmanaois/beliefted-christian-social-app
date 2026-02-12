import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import crypto from "crypto";
import { z } from "zod";

const BodySchema = z.object({
  count: z.number().int().min(1).max(1),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return NextResponse.json(
      { error: "Cloudinary is not configured" },
      { status: 500 }
    );
  }

  const parsed = BodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `beliefted/faith-stories/${session.user.id}`;
  const invalidate = "true";

  const publicId = `faith_story_${timestamp}_${crypto.randomUUID()}`;
  const signatureBase = `folder=${folder}&invalidate=${invalidate}&public_id=${publicId}&timestamp=${timestamp}`;
  const signature = crypto
    .createHash("sha1")
    .update(signatureBase + apiSecret)
    .digest("hex");

  return NextResponse.json({
    cloudName,
    apiKey,
    upload: { publicId, signature, timestamp, folder, invalidate },
  });
}
