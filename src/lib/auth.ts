import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { MongoDBAdapter } from "@auth/mongodb-adapter";
import clientPromise from "@/lib/mongodb";
import dbConnect from "@/lib/db";
import UserModel from "@/models/User";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  throw new Error("Google OAuth credentials are missing in environment variables");
}

export const authOptions: NextAuthOptions = {
  adapter: MongoDBAdapter(clientPromise),
  providers: [
    GoogleProvider({
      clientId: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: {
    strategy: "database",
  },
  callbacks: {
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.image = user.image;
        try {
          await dbConnect();
          const dbUser = await UserModel.findById(user.id).select("username").lean();
          if (dbUser?.username) {
            session.user.username = dbUser.username;
          }
        } catch {
          // ignore username lookup errors
        }
      }
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      await dbConnect();

      const existing = await UserModel.findById(user.id).lean();
      if (!existing) return;
      if (existing.username) return;

      const base = (user.name || user.email || "user")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 16);

      let candidate = base || "user";
      let suffix = 0;

      while (await UserModel.exists({ username: candidate })) {
        suffix += 1;
        const extra = Math.floor(1000 + Math.random() * 9000);
        candidate = `${base || "user"}${suffix}${extra}`;
      }

      await UserModel.findByIdAndUpdate(user.id, {
        username: candidate,
        onboardingComplete: false,
        image: null,
      });
    },
    async signIn({ user }) {
      await dbConnect();
      const existing = await UserModel.findById(user.id).lean();
      const shouldMarkOnboarded =
        existing?.onboardingComplete === undefined && Boolean(existing?.username);

      await UserModel.findByIdAndUpdate(user.id, {
        $set: {
          deletedAt: null,
          deletionRequestedAt: null,
          ...(shouldMarkOnboarded ? { onboardingComplete: true } : {}),
        },
      });
    },
  },
};
