import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import WordModel from "@/models/Word";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) {
    return NextResponse.json({ error: "Invalid word id" }, { status: 400 });
  }

  await dbConnect();

  const word = await WordModel.findById(id).select("savedBy").lean();
  if (!word) {
    return NextResponse.json({ error: "Word not found" }, { status: 404 });
  }

  const userId = session.user.id;
  const alreadySaved = Array.isArray(word.savedBy)
    ? word.savedBy.some((savedId) => String(savedId) === String(userId))
    : false;

  const update = alreadySaved
    ? { $pull: { savedBy: userId } }
    : { $addToSet: { savedBy: userId } };

  const updated = await WordModel.findByIdAndUpdate(id, update, {
    new: true,
  }).select("savedBy");

  const savedCount = Array.isArray(updated?.savedBy) ? updated.savedBy.length : 0;

  return NextResponse.json({
    saved: !alreadySaved,
    count: savedCount,
  });
}
