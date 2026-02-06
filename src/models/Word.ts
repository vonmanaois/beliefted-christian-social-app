import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const WordSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 2000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    likedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export type Word = InferSchemaType<typeof WordSchema>;

const WordModel = (models.Word as Model<Word>) || model<Word>("Word", WordSchema);

export default WordModel;
