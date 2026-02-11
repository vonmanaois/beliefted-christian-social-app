import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

const allowedThemes = ["light", "dark", "midnight", "purple-rose", "banana"] as const;

type ThemeValue = (typeof allowedThemes)[number];

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await dbConnect();

  const user = await UserModel.findById(session.user.id).lean();
  const theme = user?.theme ?? "light";
  const response = NextResponse.json({ theme });
  response.cookies.set("beliefted_theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const theme = body.theme as ThemeValue;

  if (!allowedThemes.includes(theme)) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  await dbConnect();

  await UserModel.findByIdAndUpdate(session.user.id, { theme });

  const response = NextResponse.json({ theme });
  response.cookies.set("beliefted_theme", theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
