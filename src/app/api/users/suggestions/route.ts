import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { Types } from "mongoose";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json([]);
  }

  await dbConnect();

  const currentUser = await UserModel.findById(session.user.id)
    .select("following")
    .lean();

  const excludedIds = new Set<string>([String(session.user.id)]);
  if (Array.isArray(currentUser?.following)) {
    currentUser.following.forEach((id) => excludedIds.add(String(id)));
  }

  const excludedObjectIds = Array.from(excludedIds)
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const suggestions = await UserModel.aggregate([
    {
      $match: {
        _id: { $nin: excludedObjectIds },
        username: { $exists: true, $ne: null },
        onboardingComplete: true,
        deletedAt: null,
      },
    },
    { $sample: { size: 8 } },
    {
      $project: {
        _id: 1,
        name: 1,
        username: 1,
        image: 1,
        bio: 1,
      },
    },
  ]);

  return NextResponse.json(
    suggestions.map((user) => ({
      id: String(user._id),
      name: user.name ?? null,
      username: user.username ?? null,
      image: user.image ?? null,
      bio: user.bio ?? null,
    }))
  );
}
