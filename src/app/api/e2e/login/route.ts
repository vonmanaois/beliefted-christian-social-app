import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import clientPromise from "@/lib/mongodb";

const COOKIE_NAME = "next-auth.session-token";
const PRIMARY_EMAIL = "e2e.primary@test.local";
const SECONDARY_EMAIL = "e2e.secondary@test.local";

const ensureAllowed = (request: Request) => {
  if (process.env.NODE_ENV === "production") {
    return false;
  }
  const secret = process.env.E2E_BYPASS_SECRET;
  if (!secret) return false;
  const header = request.headers.get("x-e2e-secret");
  return header === secret;
};

const normalizeUsername = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");

const ensureUniqueUsername = async (db: Awaited<ReturnType<typeof clientPromise>>["db"], base: string) => {
  let candidate = base;
  let suffix = 0;
  while (await db.collection("users").findOne({ username: candidate })) {
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
  return candidate;
};

export async function POST(request: Request) {
  if (!ensureAllowed(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => ({}))) as { user?: string };
  const userKey = payload.user === "secondary" ? "secondary" : "primary";

  const client = await clientPromise;
  const db = client.db();

  const email = userKey === "secondary" ? SECONDARY_EMAIL : PRIMARY_EMAIL;
  const name = userKey === "secondary" ? "E2E Secondary" : "E2E Primary";
  const usernameBase = normalizeUsername(userKey === "secondary" ? "e2e_secondary" : "e2e_primary");

  let user = await db.collection("users").findOne({ email });

  if (!user) {
    const username = await ensureUniqueUsername(db, usernameBase);
    const insertResult = await db.collection("users").insertOne({
      name,
      email,
      username,
      image: null,
      onboardingComplete: true,
      followers: [],
      following: [],
      prayersLiftedCount: 0,
      deletionRequestedAt: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    user = await db.collection("users").findOne({ _id: insertResult.insertedId });
  } else if (!user.username) {
    const username = await ensureUniqueUsername(db, usernameBase);
    await db.collection("users").updateOne(
      { _id: user._id },
      { $set: { username, onboardingComplete: true, updatedAt: new Date() } }
    );
    user = await db.collection("users").findOne({ _id: user._id });
  }

  if (!user?._id) {
    return NextResponse.json({ error: "User not found" }, { status: 500 });
  }

  const sessionToken = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.collection("sessions").insertOne({
    sessionToken,
    userId: user._id,
    expires,
  });

  const response = NextResponse.json({
    ok: true,
    userId: user._id.toString(),
    username: user.username ?? null,
    email,
  });

  response.cookies.set(COOKIE_NAME, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires,
  });

  return response;
}
