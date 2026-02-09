import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import "@/models/Word";
import "@/models/Prayer";
import "@/models/FaithStory";

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
    .populate("actorId", "name image username")
    .populate("userId", "username")
    .populate("prayerId", "content authorUsername")
    .populate("wordId", "content authorUsername")
    .populate("faithStoryId", "title authorUsername")
    .lean();

  return NextResponse.json(notifications);
}

export async function DELETE() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  await NotificationModel.deleteMany({ userId: session.user.id });

  return NextResponse.json({ cleared: true });
}
