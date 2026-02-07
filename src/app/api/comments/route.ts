import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import CommentModel from "@/models/Comment";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`comment-post:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const CommentSchema = z.object({
    content: z.string().trim().min(1).max(1000),
    prayerId: z.string().min(1),
  });

  const body = CommentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Prayer ID and content are required" },
      { status: 400 }
    );
  }

  const content = body.data.content.trim();
  const rawPrayerId = body.data.prayerId;
  const cleanedPrayerId = rawPrayerId.replace(/^ObjectId\\(\"(.+)\"\\)$/, "$1");
  const prayerObjectId = Types.ObjectId.isValid(cleanedPrayerId)
    ? new Types.ObjectId(cleanedPrayerId)
    : null;

  if (!content || !prayerObjectId) {
    return NextResponse.json(
      { error: "Prayer ID and content are required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const comment = await CommentModel.create({
    content,
    userId: session.user.id,
    prayerId: prayerObjectId,
  });

  const prayer = await PrayerModel.findById(prayerObjectId).lean();
  if (prayer?.userId && prayer.userId.toString() !== session.user.id) {
    await NotificationModel.create({
      userId: prayer.userId,
      actorId: session.user.id,
      prayerId: prayerObjectId,
      type: "comment",
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
