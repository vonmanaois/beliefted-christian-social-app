import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

const usernameRegex = /^[a-z0-9_]{3,20}$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = (searchParams.get("username") || "").trim().toLowerCase();

  if (!usernameRegex.test(username)) {
    return NextResponse.json({ available: false }, { status: 200 });
  }

  const client = await clientPromise;
  const db = client.db();
  const existing = await db.collection("users").findOne({ username });

  return NextResponse.json({ available: !existing });
}
