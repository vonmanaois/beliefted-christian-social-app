import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { sendFcmToUser } from "@/lib/fcm";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await sendFcmToUser(String(session.user.id), {
    title: "Beliefted",
    body: "This is a test notification.",
    url: "/notifications",
  });

  return NextResponse.json({ ok: true });
}
