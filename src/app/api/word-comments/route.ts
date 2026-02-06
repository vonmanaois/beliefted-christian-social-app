import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";
import WordModel from "@/models/Word";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const wordId = typeof body.wordId === "string" ? body.wordId : "";

  if (!content || !wordId) {
    return NextResponse.json(
      { error: "Word ID and content are required" },
      { status: 400 }
    );
  }

  await dbConnect();

  const comment = await WordCommentModel.create({
    content,
    userId: session.user.id,
    wordId,
  });

  const word = await WordModel.findById(wordId).lean();
  if (word?.userId && word.userId.toString() !== session.user.id) {
    await NotificationModel.create({
      userId: word.userId,
      actorId: session.user.id,
      wordId,
      type: "word_comment",
    });
  }

  return NextResponse.json(comment, { status: 201 });
}
