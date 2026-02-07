import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import PrayerModel from "@/models/Prayer";
import CommentModel from "@/models/Comment";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";

export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  if (!Types.ObjectId.isValid(userId)) {
    return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
  }

  const userObjectId = new Types.ObjectId(userId);

  await dbConnect();

  await Promise.all([
    UserModel.updateMany(
      { followers: userObjectId },
      { $pull: { followers: userObjectId } }
    ),
    UserModel.updateMany(
      { following: userObjectId },
      { $pull: { following: userObjectId } }
    ),
    PrayerModel.updateMany(
      { prayedBy: userObjectId },
      { $pull: { prayedBy: userObjectId } }
    ),
    WordModel.updateMany(
      { likedBy: userObjectId },
      { $pull: { likedBy: userObjectId } }
    ),
    CommentModel.deleteMany({ userId: userObjectId }),
    WordCommentModel.deleteMany({ userId: userObjectId }),
    PrayerModel.deleteMany({ userId: userObjectId }),
    WordModel.deleteMany({ userId: userObjectId }),
    NotificationModel.deleteMany({
      $or: [{ userId: userObjectId }, { actorId: userObjectId }],
    }),
    UserModel.deleteOne({ _id: userObjectId }),
  ]);

  return NextResponse.json({ success: true });
}
