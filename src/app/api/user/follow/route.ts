import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";
import NotificationModel from "@/models/Notification";
import { z } from "zod";
import { rateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = rateLimit(`follow:${session.user.id}`, 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const FollowSchema = z.object({
      userId: z.string().min(1),
    });

    const body = FollowSchema.safeParse(await req.json());
    if (!body.success) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    const targetUserId = body.data.userId;

    if (!targetUserId || targetUserId === session.user.id) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }

    await dbConnect();

    const currentUser = await UserModel.findById(session.user.id);
    const targetUser = await UserModel.findById(targetUserId);

    if (!currentUser || !targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isFollowing = Array.isArray(currentUser.following)
      ? currentUser.following.some((id) => id.toString() === targetUserId)
      : false;

    if (isFollowing) {
      await UserModel.updateOne(
        { _id: currentUser._id },
        { $pull: { following: targetUser._id } }
      );
      await UserModel.updateOne(
        { _id: targetUser._id },
        { $pull: { followers: currentUser._id } }
      );
    } else {
      await UserModel.updateOne(
        { _id: currentUser._id },
        { $addToSet: { following: targetUser._id } }
      );
      await UserModel.updateOne(
        { _id: targetUser._id },
        { $addToSet: { followers: currentUser._id } }
      );

      NotificationModel.create({
        userId: targetUser._id,
        actorId: currentUser._id,
        type: "follow",
      }).catch((error) => {
        console.error("[follow-notification]", error);
      });
    }

    const updatedTarget = await UserModel.findById(targetUser._id);

    return NextResponse.json({
      following: !isFollowing,
      followersCount: Array.isArray(updatedTarget?.followers)
        ? updatedTarget.followers.length
        : 0,
    });
  } catch (error) {
    console.error("[follow]", error);
    return NextResponse.json({ error: "Failed to update follow status" }, { status: 500 });
  }
}
