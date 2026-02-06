import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";
import WordModel from "@/models/Word";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const rawId = id;
  const cleanedId = rawId.replace(/^ObjectId\(\"(.+)\"\)$/, "$1");
  const word = await WordModel.findById(cleanedId);

  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const alreadyLiked = word.likedBy?.some((id) => id.toString() === userId);

  const update = alreadyLiked
    ? { $pull: { likedBy: userId } }
    : { $addToSet: { likedBy: userId } };

  const updated = await WordModel.findByIdAndUpdate(word.id, update, {
    new: true,
  });

  if (!alreadyLiked && word.userId?.toString() !== userId) {
    await NotificationModel.create({
      userId: word.userId,
      actorId: userId,
      wordId: word.id,
      type: "word_like",
    });
  }

  return NextResponse.json({
    liked: !alreadyLiked,
    count: updated?.likedBy.length ?? word.likedBy.length,
  });
}
