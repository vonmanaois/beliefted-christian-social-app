import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const WordCommentSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    wordId: { type: Schema.Types.ObjectId, ref: "Word", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type WordComment = InferSchemaType<typeof WordCommentSchema>;

const WordCommentModel =
  (models.WordComment as Model<WordComment>) ||
  model<WordComment>("WordComment", WordCommentSchema);

export default WordCommentModel;
