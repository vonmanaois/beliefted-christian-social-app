import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import UserModel from "@/models/User";
import "@/models/Word";
import "@/models/Prayer";
import "@/models/FaithStory";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const currentUser = await UserModel.findById(session.user.id)
    .select("following")
    .lean();
  const followingIds = Array.isArray(currentUser?.following) ? currentUser.following : [];
  const followingSet = new Set(followingIds.map((id) => id.toString()));

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

  const enriched = notifications.map((note) => {
    if (note.type !== "follow") return note;
    const actorId = (note as { actorId?: { _id?: unknown } }).actorId?._id;
    const actorIdString = actorId ? String(actorId) : null;
    return {
      ...note,
      isFollowing: actorIdString ? followingSet.has(actorIdString) : false,
    };
  });

  return NextResponse.json(enriched);
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
