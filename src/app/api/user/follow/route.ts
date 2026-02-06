import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const targetUserId = typeof body.userId === "string" ? body.userId : "";

  if (!targetUserId || targetUserId === session.user.id) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  const currentUserId = ObjectId.isValid(session.user.id)
    ? new ObjectId(session.user.id)
    : null;
  const targetId = ObjectId.isValid(targetUserId)
    ? new ObjectId(targetUserId)
    : null;

  if (!targetId) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const currentUser = currentUserId
    ? await db.collection("users").findOne({ _id: currentUserId })
    : await db.collection("users").findOne({ email: session.user.email });

  const targetUser = await db.collection("users").findOne({ _id: targetId });

  if (!currentUser || !targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const isFollowing = Array.isArray(currentUser.following)
    ? currentUser.following.some((id: ObjectId) => id.toString() === targetUserId)
    : false;

  if (isFollowing) {
    await db.collection("users").updateOne(
      { _id: currentUser._id },
      { $pull: { following: targetId } }
    );
    await db.collection("users").updateOne(
      { _id: targetId },
      { $pull: { followers: currentUser._id } }
    );
  } else {
    await db.collection("users").updateOne(
      { _id: currentUser._id },
      { $addToSet: { following: targetId } }
    );
    await db.collection("users").updateOne(
      { _id: targetId },
      { $addToSet: { followers: currentUser._id } }
    );
  }

  const updatedTarget = await db.collection("users").findOne({ _id: targetId });

  return NextResponse.json({
    following: !isFollowing,
    followersCount: Array.isArray(updatedTarget?.followers)
      ? updatedTarget.followers.length
      : 0,
  });
}
