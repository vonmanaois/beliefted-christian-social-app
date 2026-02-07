import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const username = searchParams.get("username");

  if (type !== "followers" && type !== "following") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const client = await clientPromise;
  const db = client.db();

  let user: { _id?: ObjectId; followers?: ObjectId[]; following?: ObjectId[] } | null =
    null;

  if (username) {
    user = (await db.collection("users").findOne({ username })) as typeof user;
  } else {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = ObjectId.isValid(session.user.id)
      ? new ObjectId(session.user.id)
      : null;
    if (!userId) {
      return NextResponse.json({ error: "Invalid user" }, { status: 400 });
    }
    user = (await db.collection("users").findOne({ _id: userId })) as typeof user;
  }

  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const ids =
    type === "followers"
      ? (user.followers ?? [])
      : (user.following ?? []);

  if (!ids.length) {
    return NextResponse.json([]);
  }

  const people = await db
    .collection("users")
    .find({ _id: { $in: ids } })
    .project({ name: 1, username: 1, image: 1 })
    .toArray();

  const results = people.map((person) => ({
    id: person._id?.toString() ?? "",
    name: person.name ?? null,
    username: person.username ?? null,
    image: person.image ?? null,
  }));

  return NextResponse.json(results);
}
