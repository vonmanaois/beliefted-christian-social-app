import { Schema, model, models, type InferSchemaType, type Model } from "mongoose";

const FcmTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    userAgent: { type: String, default: null },
  },
  { timestamps: true }
);

FcmTokenSchema.index({ userId: 1, createdAt: -1 });

export type FcmToken = InferSchemaType<typeof FcmTokenSchema>;

const FcmTokenModel =
  (models.FcmToken as Model<FcmToken>) || model<FcmToken>("FcmToken", FcmTokenSchema);

export default FcmTokenModel;
