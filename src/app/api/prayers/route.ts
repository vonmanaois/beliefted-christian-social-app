import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import CommentModel from "@/models/Comment";
import PrayerModel from "@/models/Prayer";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  await dbConnect();

  const filter = userId ? { userId } : {};

  const prayers = await PrayerModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "name image username")
    .lean();

  const sanitized = await Promise.all(
    prayers.map(async (prayer) => {
      const { userId, ...rest } = prayer as typeof prayer & {
        userId?: { name?: string; image?: string; _id?: { toString: () => string } } | null;
      };

      const rawUserId = (prayer as { userId?: { _id?: { toString: () => string } } | { toString: () => string } }).userId;
      const userIdString =
        typeof rawUserId === "string"
          ? rawUserId
          : rawUserId && typeof (rawUserId as { toString?: () => string }).toString === "function"
            ? (rawUserId as { toString: () => string }).toString()
            : rawUserId && typeof (rawUserId as { _id?: { toString: () => string } })._id?.toString === "function"
              ? (rawUserId as { _id: { toString: () => string } })._id.toString()
              : null;

      const base = { ...rest, _id: prayer._id.toString(), userId: userIdString };

      if (prayer.isAnonymous) {
        const commentCount = await CommentModel.countDocuments({
          prayerId: prayer._id,
        });
        return { ...base, user: null, commentCount };
      }

      const commentCount = await CommentModel.countDocuments({
        prayerId: prayer._id,
      });
      return { ...base, user: userId ?? null, commentCount };
    })
  );

  return NextResponse.json(sanitized);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const isAnonymous = Boolean(body.isAnonymous);
  const expiresInDays = body.expiresInDays === 30 ? 30 : 7;

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  await dbConnect();

  const prayer = await PrayerModel.create({
    content,
    userId: session.user.id,
    isAnonymous,
    prayedBy: [],
    expiresAt,
  });

  return NextResponse.json(prayer, { status: 201 });
}
