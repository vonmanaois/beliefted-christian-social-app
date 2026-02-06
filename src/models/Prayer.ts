import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

const PrayerSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    isAnonymous: { type: Boolean, default: false },
    prayedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

PrayerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type Prayer = InferSchemaType<typeof PrayerSchema> & {
  _id: Types.ObjectId;
};

const PrayerModel =
  (models.Prayer as Model<Prayer>) || model<Prayer>("Prayer", PrayerSchema);

export default PrayerModel;
