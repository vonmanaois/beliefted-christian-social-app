import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { sendFcmToUser } from "@/lib/fcm";

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

const pushNotification = async (doc: Notification) => {
  if (!doc?.userId) return;
  await sendFcmToUser(String(doc.userId), {
    title: "New notification",
    body: "Open Beliefted to see the latest activity.",
    url: "/notifications",
  });
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
