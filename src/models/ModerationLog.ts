import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const ModerationLogSchema = new Schema(
  {
    targetType: {
      type: String,
      enum: ["word", "prayer", "faith_story"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    moderatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reason: {
      type: String,
      enum: ["Off-topic", "Inappropriate", "Spam", "Asking money"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

ModerationLogSchema.index({ targetType: 1, targetId: 1 });
ModerationLogSchema.index({ authorId: 1, createdAt: -1 });
ModerationLogSchema.index({ moderatorId: 1, createdAt: -1 });

export type ModerationLog = InferSchemaType<typeof ModerationLogSchema>;

const ModerationLogModel =
  (models.ModerationLog as Model<ModerationLog>) ||
  model<ModerationLog>("ModerationLog", ModerationLogSchema);

export default ModerationLogModel;
