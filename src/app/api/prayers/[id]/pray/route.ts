import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import PrayerModel from "@/models/Prayer";

export async function POST(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const prayer = await PrayerModel.findById(params.id);

  if (!prayer) {
    return NextResponse.json({ error: "Prayer not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const alreadyPrayed = prayer.prayedBy.some(
    (id) => id.toString() === userId
  );

  const update = alreadyPrayed
    ? { $pull: { prayedBy: userId } }
    : { $addToSet: { prayedBy: userId } };

  const updated = await PrayerModel.findByIdAndUpdate(prayer.id, update, {
    new: true,
  });

  if (!alreadyPrayed && prayer.userId?.toString() !== userId) {
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
