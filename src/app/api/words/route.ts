import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  await dbConnect();

  const filter = userId ? { userId } : {};
  const words = await WordModel.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("userId", "name image username")
    .lean();

  const sanitized = await Promise.all(
    words.map(async (word) => {
      const { userId: author, ...rest } = word as typeof word & {
        userId?: { name?: string; image?: string; username?: string; _id?: { toString: () => string } } | null;
      };

      const rawUserId = (word as {
        userId?: { _id?: { toString: () => string } } | { toString: () => string } | string | null;
      }).userId;
      let userIdString: string | null = null;
      if (typeof rawUserId === "string") {
        userIdString = rawUserId;
      } else if (
        rawUserId &&
        typeof (rawUserId as { _id?: { toString: () => string } })._id?.toString === "function"
      ) {
        userIdString = (rawUserId as { _id: { toString: () => string } })._id.toString();
      } else if (rawUserId && typeof (rawUserId as { toString?: () => string }).toString === "function") {
        const asString = (rawUserId as { toString: () => string }).toString();
        userIdString = asString !== "[object Object]" ? asString : null;
      }

      const commentCount = await WordCommentModel.countDocuments({
        wordId: word._id,
      });
      return {
        ...rest,
        _id: word._id.toString(),
        user: author ?? null,
        commentCount,
        userId: userIdString,
        isOwner: Boolean(session?.user?.id && userIdString && session.user.id === userIdString),
      };
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

  if (!content) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }

  await dbConnect();

  const word = await WordModel.create({
    content,
    userId: session.user.id,
  });

  return NextResponse.json(word, { status: 201 });
}
