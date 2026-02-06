import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prayerId: { type: Schema.Types.ObjectId, ref: "Prayer" },
    wordId: { type: Schema.Types.ObjectId, ref: "Word" },
    type: { type: String, enum: ["pray", "comment", "word_like", "word_comment"], required: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type Notification = InferSchemaType<typeof NotificationSchema>;

const NotificationModel =
  (models.Notification as Model<Notification>) ||
  model<Notification>("Notification", NotificationSchema);

export default NotificationModel;
