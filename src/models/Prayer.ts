import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

const PrayerSchema = new Schema(
  {
    content: { type: String, trim: true, maxlength: 2000 },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    authorName: { type: String, trim: true },
    authorUsername: { type: String, trim: true },
    authorImage: { type: String, trim: true },
    kind: { type: String, enum: ["prayer", "request"], default: "prayer" },
    heading: { type: String, trim: true, maxlength: 120 },
    prayerPoints: [
      {
        title: { type: String, trim: true, maxlength: 120 },
        description: { type: String, trim: true, maxlength: 400 },
      },
    ],
    isAnonymous: { type: Boolean, default: false },
    prayedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    expiresAt: { type: Date },
  },
  { timestamps: true }
);

PrayerSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
PrayerSchema.index({ createdAt: -1 });
PrayerSchema.index({ userId: 1, createdAt: -1 });
PrayerSchema.index({ userId: 1, isAnonymous: 1, createdAt: -1 });
PrayerSchema.index({ prayedBy: 1 });

export type Prayer = InferSchemaType<typeof PrayerSchema> & {
  _id: Types.ObjectId;
};

const PrayerModel =
  (models.Prayer as Model<Prayer>) || model<Prayer>("Prayer", PrayerSchema);

export default PrayerModel;
