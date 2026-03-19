import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const DayStorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    imageUrl: { type: String, required: true, trim: true },
    expiresAt: { type: Date, required: true },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DayStorySchema.index({ expiresAt: 1 });
DayStorySchema.index({ userId: 1, createdAt: -1 });

export type DayStory = InferSchemaType<typeof DayStorySchema>;

const DayStoryModel =
  (models.DayStory as Model<DayStory>) || model<DayStory>("DayStory", DayStorySchema);

export default DayStoryModel;
