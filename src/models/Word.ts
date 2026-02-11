import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const WordSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    authorName: { type: String, trim: true },
    authorUsername: { type: String, trim: true },
    authorImage: { type: String, trim: true },
    scriptureRef: { type: String, trim: true, maxlength: 80 },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
    savedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

WordSchema.index({ createdAt: -1 });
WordSchema.index({ userId: 1, createdAt: -1 });
WordSchema.index({ likedBy: 1 });
WordSchema.index({ savedBy: 1 });

export type Word = InferSchemaType<typeof WordSchema>;

const WordModel = (models.Word as Model<Word>) || model<Word>("Word", WordSchema);

export default WordModel;
