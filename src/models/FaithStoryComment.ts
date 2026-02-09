import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const FaithStoryCommentSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    storyId: { type: Schema.Types.ObjectId, ref: "FaithStory", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

FaithStoryCommentSchema.index({ storyId: 1, createdAt: -1 });

export type FaithStoryComment = InferSchemaType<typeof FaithStoryCommentSchema>;

const FaithStoryCommentModel =
  (models.FaithStoryComment as Model<FaithStoryComment>) ||
  model<FaithStoryComment>("FaithStoryComment", FaithStoryCommentSchema);

export default FaithStoryCommentModel;
