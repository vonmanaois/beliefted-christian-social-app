import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordCommentModel from "@/models/WordComment";
import NotificationModel from "@/models/Notification";
import WordModel from "@/models/Word";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";
import { notifyMentions } from "@/lib/mentionNotifications";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = rateLimit(`word-comment-post:${session.user.id}`, 10, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const WordCommentSchema = z.object({
    content: z.string().trim().min(1).max(1000),
    wordId: z.string().min(1),
  });

  const body = WordCommentSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json(
      { error: "Word ID and content are required" },
      { status: 400 }
    );
  }

  const content = body.data.content.trim();
  const wordId = body.data.wordId;

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

  await notifyMentions({
    text: content,
    actorId: session.user.id,
    wordId: String(wordId),
  });

  return NextResponse.json(comment, { status: 201 });
}
