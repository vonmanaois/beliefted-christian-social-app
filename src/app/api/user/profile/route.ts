import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

const usernameRegex = /^[a-z0-9_]{3,20}$/;

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!usernameRegex.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars, lowercase, numbers or underscore." },
      { status: 400 }
    );
  }

  await dbConnect();

  const exists = await UserModel.findOne({
    username,
    _id: { $ne: session.user.id },
  }).lean();

  if (exists) {
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }

  await UserModel.findByIdAndUpdate(session.user.id, {
    username,
    ...(name ? { name } : {}),
  });

  return NextResponse.json({ username, name: name || undefined });
}
