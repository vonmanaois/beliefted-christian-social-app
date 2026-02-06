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
  const bio = typeof body.bio === "string" ? body.bio.trim() : "";

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
    name,
    bio: bio.slice(0, 280),
  });

  return NextResponse.json({ username, name, bio });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username");

  await dbConnect();

  if (usernameParam) {
    const user = await UserModel.findOne({ username: usernameParam }).lean();
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      name: user.name ?? null,
      username: user.username ?? null,
      bio: user.bio ?? null,
    });
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await UserModel.findById(session.user.id).lean();

  return NextResponse.json({
    name: user?.name ?? null,
    username: user?.username ?? null,
    bio: user?.bio ?? null,
  });
}
