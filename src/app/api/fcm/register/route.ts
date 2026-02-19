import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import FcmTokenModel from "@/models/FcmToken";

type RegisterBody = {
  token?: string;
};

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as RegisterBody;
  if (!body?.token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }

  await dbConnect();
  await FcmTokenModel.updateOne(
    { token: body.token },
    {
      $set: {
        userId: session.user.id,
        token: body.token,
        userAgent: request.headers.get("user-agent") ?? null,
      },
    },
    { upsert: true }
  );

  return NextResponse.json({ ok: true });
}
