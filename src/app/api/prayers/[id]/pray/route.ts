import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";
import UserModel from "@/models/User";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`pray:${session.user.id}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  await dbConnect();

  const rawId = id;
  const cleanedId = rawId.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  const prayer = await PrayerModel.findById(cleanedId);

  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const alreadyPrayed = prayer.prayedBy.some(
    (id) => id.toString() === userId
  );

  if (alreadyPrayed) {
    return NextResponse.json({
      prayed: true,
      count: prayer.prayedBy.length,
    });
  }

  const update = { $addToSet: { prayedBy: userId } };

  const updated = await PrayerModel.findByIdAndUpdate(prayer.id, update, {
    new: true,
  });

  await UserModel.findByIdAndUpdate(userId, {
    $inc: { prayersLiftedCount: 1 },
  });

  if (!alreadyPrayed && prayer.userId && prayer.userId.toString() !== userId) {
    await NotificationModel.create({
      userId: prayer.userId,
      actorId: userId,
      prayerId: prayer.id,
      type: "pray",
    });
  }

  return NextResponse.json({
    prayed: !alreadyPrayed,
    count: updated?.prayedBy.length ?? prayer.prayedBy.length,
  });
}
