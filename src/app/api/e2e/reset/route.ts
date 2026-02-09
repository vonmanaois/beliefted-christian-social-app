import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import PrayerModel from "@/models/Prayer";
import WordModel from "@/models/Word";
import CommentModel from "@/models/Comment";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";

const PRIMARY_EMAIL = "e2e.primary@test.local";
const SECONDARY_EMAIL = "e2e.secondary@test.local";

const ensureAllowed = (request: Request) => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-e2e-secret");
  return header === secret;
};

export async function POST(request: Request) {
  if (!ensureAllowed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const client = await clientPromise;
  const db = client.db();

  const users = await db
    .collection("users")
    .find({ email: { $in: [PRIMARY_EMAIL, SECONDARY_EMAIL] } })
    .project({ _id: 1 })
    .toArray();

  const userIds = users.map((user) => user._id);
  if (userIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  const prayers = await PrayerModel.find({ userId: { $in: userIds } }).select("_id");
  const words = await WordModel.find({ userId: { $in: userIds } }).select("_id");

  const prayerIds = prayers.map((prayer) => prayer._id);
  const wordIds = words.map((word) => word._id);

  await Promise.all([
    CommentModel.deleteMany({
      $or: [{ userId: { $in: userIds } }, { prayerId: { $in: prayerIds } }],
    }),
    WordCommentModel.deleteMany({
      $or: [{ userId: { $in: userIds } }, { wordId: { $in: wordIds } }],
    }),
    PrayerModel.deleteMany({ userId: { $in: userIds } }),
    WordModel.deleteMany({ userId: { $in: userIds } }),
    NotificationModel.deleteMany({
      $or: [{ userId: { $in: userIds } }, { actorId: { $in: userIds } }],
    }),
    UserModel.updateMany(
      { _id: { $in: userIds } },
      {
        $set: {
          followers: [],
          following: [],
          prayersLiftedCount: 0,
        },
      }
    ),
    db.collection("sessions").deleteMany({ userId: { $in: userIds } }),
  ]);

  return NextResponse.json({ ok: true });
}
