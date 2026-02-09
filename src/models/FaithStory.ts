import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const FaithStorySchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, trim: true, maxlength: 10000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, trim: true },
    authorUsername: { type: String, trim: true },
    authorImage: { type: String, trim: true },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

FaithStorySchema.index({ createdAt: -1 });
FaithStorySchema.index({ userId: 1, createdAt: -1 });
FaithStorySchema.index({ likedBy: 1 });
FaithStorySchema.index({
  title: "text",
  content: "text",
  authorName: "text",
  authorUsername: "text",
});

export type FaithStory = InferSchemaType<typeof FaithStorySchema>;

const FaithStoryModel =
  (models.FaithStory as Model<FaithStory>) ||
  model<FaithStory>("FaithStory", FaithStorySchema);

export default FaithStoryModel;
