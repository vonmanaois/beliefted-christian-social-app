import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const JournalSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    content: { type: String, required: true, trim: true, maxlength: 5000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

JournalSchema.index({ userId: 1, createdAt: -1 });

export type Journal = InferSchemaType<typeof JournalSchema>;

const JournalModel =
  (models.Journal as Model<Journal>) || model<Journal>("Journal", JournalSchema);

export default JournalModel;
