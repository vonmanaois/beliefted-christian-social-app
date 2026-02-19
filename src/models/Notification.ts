import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { sendFcmToUser } from "@/lib/fcm";
import UserModel from "@/models/User";
import WordModel from "@/models/Word";
import PrayerModel from "@/models/Prayer";
import FaithStoryModel from "@/models/FaithStory";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prayerId: { type: Schema.Types.ObjectId, ref: "Prayer" },
    wordId: { type: Schema.Types.ObjectId, ref: "Word" },
    type: {
      type: String,
      enum: [
        "pray",
        "comment",
        "word_like",
        "word_comment",
        "follow",
        "faith_like",
        "faith_comment",
        "mention",
        "moderation",
      ],
      required: true,
    },
    faithStoryId: { type: Schema.Types.ObjectId, ref: "FaithStory" },
    moderationReason: { type: String },
    moderationTarget: {
      type: String,
      enum: ["word", "prayer", "faith_story"],
    },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });
NotificationSchema.index({ userId: 1, readAt: 1 });

const buildPushPayload = async (doc: Notification) => {
  const actor = doc.actorId
    ? await UserModel.findById(doc.actorId).select("name username").lean()
    : null;
  const actorName = actor?.name ?? actor?.username ?? "Someone";
  const fallbackUrl = "/?open=notifications";

  if (doc.type === "follow") {
    const profile = actor?.username ? `/profile/${actor.username}` : fallbackUrl;
    return {
      title: "New follower",
      body: `${actorName} followed you.`,
      url: profile,
    };
  }

  if (doc.wordId) {
    const word = await WordModel.findById(doc.wordId)
      .select("authorUsername")
      .lean();
    const authorUsername = word?.authorUsername ?? null;
    const url = authorUsername ? `/${authorUsername}/${doc.wordId}` : fallbackUrl;
    const bodyMap: Record<string, string> = {
      word_like: `${actorName} liked your word.`,
      word_comment: `${actorName} commented on your word.`,
      mention: `${actorName} mentioned you.`,
    };
    return {
      title: "New activity",
      body: bodyMap[doc.type] ?? "Open Beliefted to see the latest activity.",
      url,
    };
  }

  if (doc.prayerId) {
    const prayer = await PrayerModel.findById(doc.prayerId)
      .select("authorUsername")
      .lean();
    const authorUsername = prayer?.authorUsername ?? null;
    const url = authorUsername ? `/${authorUsername}/${doc.prayerId}` : fallbackUrl;
    const bodyMap: Record<string, string> = {
      pray: `${actorName} prayed for you.`,
      comment: `${actorName} commented on your prayer.`,
      mention: `${actorName} mentioned you.`,
    };
    return {
      title: "New activity",
      body: bodyMap[doc.type] ?? "Open Beliefted to see the latest activity.",
      url,
    };
  }

  if (doc.faithStoryId) {
    const story = await FaithStoryModel.findById(doc.faithStoryId)
      .select("authorUsername")
      .lean();
    const authorUsername = story?.authorUsername ?? null;
    const url = authorUsername
      ? `/faith-story/${authorUsername}/${doc.faithStoryId}`
      : fallbackUrl;
    const bodyMap: Record<string, string> = {
      faith_like: `${actorName} liked your faith story.`,
      faith_comment: `${actorName} commented on your faith story.`,
    };
    return {
      title: "New activity",
      body: bodyMap[doc.type] ?? "Open Beliefted to see the latest activity.",
      url,
    };
  }

  if (doc.type === "moderation") {
    return {
      title: "Content update",
      body: "There is an update to your content.",
      url: fallbackUrl,
    };
  }

  return {
    title: "New notification",
    body: "Open Beliefted to see the latest activity.",
    url: fallbackUrl,
  };
};

const pushNotification = async (doc: Notification) => {
  if (!doc?.userId) return;
  const payload = await buildPushPayload(doc);
  await sendFcmToUser(String(doc.userId), payload);
};

NotificationSchema.post("save", (doc) => {
  void pushNotification(doc);
});

NotificationSchema.post("insertMany", (docs) => {
  if (!Array.isArray(docs)) return;
  docs.forEach((doc) => {
    void pushNotification(doc);
  });
});

export type Notification = InferSchemaType<typeof NotificationSchema>;

const NotificationModel =
  (models.Notification as Model<Notification>) ||
  model<Notification>("Notification", NotificationSchema);

export default NotificationModel;
