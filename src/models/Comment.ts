import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const CommentSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    prayerId: { type: Schema.Types.ObjectId, ref: "Prayer", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export type Comment = InferSchemaType<typeof CommentSchema>;

const CommentModel =
  (models.Comment as Model<Comment>) || model<Comment>("Comment", CommentSchema);

export default CommentModel;
