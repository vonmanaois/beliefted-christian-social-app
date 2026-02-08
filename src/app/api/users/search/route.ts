import { NextResponse } from "next/server";
import { headers } from "next/headers";
import clientPromise from "@/lib/mongodb";
import { rateLimit } from "@/lib/rateLimit";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim().toLowerCase() ?? "";

  const safeQuery = q.replace(/[^\w\s.@-]/g, "");
  if (!safeQuery || safeQuery.length < 2) {
    return NextResponse.json([]);
  }

  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for") ?? "";
  const ip = forwardedFor.split(",")[0]?.trim() || headerList.get("x-real-ip") || "unknown";
  const rate = rateLimit(`search:${ip}`, 30, 60_000);
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests. Try again soon." }, { status: 429 });
  }

  const client = await clientPromise;
  const db = client.db();

  const escaped = safeQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const users = await db
    .collection("users")
    .find({
      $or: [
        { username: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
      ],
    })
    .project({ username: 1, name: 1, image: 1 })
    .limit(10)
    .toArray();

  const result = users.map((user) => ({
    id: user._id?.toString(),
    username: user.username ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  }));

  return NextResponse.json(result);
}
