import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";
import WordCommentModel from "@/models/WordComment";

export async function GET(req: Request) {
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
        userId?: { name?: string; image?: string; username?: string } | null;
      };

      const commentCount = await WordCommentModel.countDocuments({
        wordId: word._id,
      });
      return { ...rest, user: author ?? null, commentCount };
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
