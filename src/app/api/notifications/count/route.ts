import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import NotificationModel from "@/models/Notification";

export async function GET() {
  if (
    process.env.DISABLE_NOTIFICATIONS_COUNT === "1" ||
    process.env.NEXT_PUBLIC_DISABLE_NOTIFICATIONS_COUNT === "1"
  ) {
    return NextResponse.json({ count: 0 }, { status: 200 });
  }
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();
  const count = await NotificationModel.countDocuments({ userId: session.user.id });
  return NextResponse.json({ count });
}
