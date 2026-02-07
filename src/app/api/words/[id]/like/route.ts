import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import WordModel from "@/models/Word";
import { Types } from "mongoose";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`word-like:${session.user.id}`, 20, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const rawId = id ?? "";
    const cleanedId = rawId.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
    if (!Types.ObjectId.isValid(cleanedId)) {
      return NextResponse.json({ error: "Invalid word id" }, { status: 400 });
    }

    await dbConnect();

    const word = await WordModel.findById(cleanedId);

    if (!word) {
      return NextResponse.json({ error: "Word not found" }, { status: 404 });
    }

    const userId = session.user.id;
    const alreadyLiked = (word.likedBy ?? []).some((id) => id.toString() === userId);

    const update = alreadyLiked
      ? { $pull: { likedBy: userId } }
      : { $addToSet: { likedBy: userId } };

    const updated = await WordModel.findByIdAndUpdate(cleanedId, update, {
      new: true,
      select: "likedBy",
    });

    if (!alreadyLiked && word.userId?.toString() !== userId) {
      await NotificationModel.create({
        userId: word.userId,
        actorId: userId,
        wordId: word.id,
        type: "word_like",
      });
    }

    const count = updated?.likedBy?.length ?? word.likedBy?.length ?? 0;

    return NextResponse.json({
      liked: !alreadyLiked,
      count,
    });
  } catch (error) {
    console.error("[word-like]", error);
    return NextResponse.json({ error: "Failed to like word" }, { status: 500 });
  }
}
