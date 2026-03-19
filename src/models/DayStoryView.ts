import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const DayStoryViewSchema = new Schema(
  {
    storyId: { type: Schema.Types.ObjectId, ref: "DayStory", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

DayStoryViewSchema.index({ storyId: 1, createdAt: -1 });
DayStoryViewSchema.index({ storyId: 1, userId: 1 }, { unique: true });

export type DayStoryView = InferSchemaType<typeof DayStoryViewSchema>;

const DayStoryViewModel =
  (models.DayStoryView as Model<DayStoryView>) ||
  model<DayStoryView>("DayStoryView", DayStoryViewSchema);

export default DayStoryViewModel;
