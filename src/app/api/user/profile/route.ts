import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import dbConnect from "@/lib/db";
import { z } from "zod";

const usernameRegex = /^[a-z0-9_]{3,20}$/;

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ProfileSchema = z.object({
    username: z.string().trim().min(3).max(20),
    name: z.string().trim().max(100).optional().or(z.literal("")),
    bio: z.string().trim().max(280).optional().or(z.literal("")),
    image: z
      .string()
      .trim()
      .optional()
      .or(z.literal("")),
  });

  const body = ProfileSchema.safeParse(await req.json());
  if (!body.success) {
    return NextResponse.json({ error: "Invalid profile data" }, { status: 400 });
  }

  const username = body.data.username.trim();
  const name = (body.data.name ?? "").trim();
  const bio = (body.data.bio ?? "").trim();
  const image = (body.data.image ?? "").trim();
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

  if (image) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(image);
    } catch {
      return NextResponse.json({ error: "Invalid image URL." }, { status: 400 });
    }

    const isCloudinary =
      cloudName &&
      parsed.hostname === "res.cloudinary.com" &&
      parsed.pathname.startsWith(`/${cloudName}/`);
    const isGoogleAvatar = parsed.hostname === "lh3.googleusercontent.com";

    if (!isCloudinary && !isGoogleAvatar) {
      return NextResponse.json(
        { error: "Image URL must be a Cloudinary or Google image." },
        { status: 400 }
      );
    }
  }

  if (!usernameRegex.test(username)) {
    return NextResponse.json(
      { error: "Username must be 3-20 chars, lowercase, numbers or underscore." },
      { status: 400 }
    );
  }

  const client = await clientPromise;
  const db = client.db();
  const userObjectId = ObjectId.isValid(session.user.id)
    ? new ObjectId(session.user.id)
    : null;
  const userFilter = session.user.email && session.user.email.length > 0
    ? { email: session.user.email }
    : userObjectId
      ? { _id: userObjectId }
      : null;

  if (!userFilter) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const exists = await db.collection("users").findOne({
    username,
    _id: userObjectId ? { $ne: userObjectId } : undefined,
  });

  if (exists) {
    return NextResponse.json({ error: "Username already taken." }, { status: 409 });
  }

  await db.collection("users").updateOne(
    userFilter,
    {
      $set: {
        username,
        name,
        bio: bio.slice(0, 280),
        image: image || null,
        onboardingComplete: true,
      },
    }
  );

  const updated = await db.collection("users").findOne(userFilter);

  return NextResponse.json({
    username: updated?.username ?? username,
    name: updated?.name ?? name,
    bio: updated?.bio ?? bio,
    image: updated?.image ?? (image || null),
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const usernameParam = searchParams.get("username");

  const client = await clientPromise;
  const db = client.db();

  if (usernameParam) {
    await dbConnect();
    const user = await db.collection("users").findOne({ username: usernameParam });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    const prayersLiftedCount =
      typeof user.prayersLiftedCount === "number" ? user.prayersLiftedCount : 0;

    return NextResponse.json(
      {
        name: user.name ?? null,
        username: user.username ?? null,
        bio: user.bio ?? null,
        image: user.image ?? null,
        followersCount: Array.isArray(user.followers) ? user.followers.length : 0,
        followingCount: Array.isArray(user.following) ? user.following.length : 0,
        prayersLiftedCount: typeof prayersLiftedCount === "number" ? prayersLiftedCount : 0,
      },
      {
        headers: {
          "Cache-Control": "private, max-age=30",
        },
      }
    );
  }

  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = ObjectId.isValid(session.user.id)
    ? new ObjectId(session.user.id)
    : null;
  const userFilter = session.user.email && session.user.email.length > 0
    ? { email: session.user.email }
    : userId
      ? { _id: userId }
      : null;

  if (!userFilter) {
    return NextResponse.json({ error: "Invalid user" }, { status: 400 });
  }

  const user = await db.collection("users").findOne(userFilter);
  const prayersLiftedCount =
    typeof user?.prayersLiftedCount === "number" ? user.prayersLiftedCount : 0;

  return NextResponse.json({
    name: user?.name ?? null,
    username: user?.username ?? null,
    bio: user?.bio ?? null,
    image: user?.image ?? null,
    followersCount: Array.isArray(user?.followers) ? user.followers.length : 0,
    followingCount: Array.isArray(user?.following) ? user.following.length : 0,
    prayersLiftedCount: typeof prayersLiftedCount === "number" ? prayersLiftedCount : 0,
    onboardingComplete: Boolean(user?.onboardingComplete),
  });
}
