import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const notifications = await NotificationModel.find({
    userId: session.user.id,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("actorId", "name image")
    .populate("prayerId", "content")
    .populate("wordId", "content")
    .lean();

  return NextResponse.json(notifications);
}
