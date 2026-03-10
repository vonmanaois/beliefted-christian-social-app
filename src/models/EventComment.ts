import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const EventCommentSchema = new Schema(
  {
    content: { type: String, required: true, trim: true, maxlength: 1000 },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "EventComment", default: null },
    isHostReply: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

EventCommentSchema.index({ eventId: 1, createdAt: -1 });
EventCommentSchema.index({ eventId: 1, parentId: 1, createdAt: -1 });

export type EventComment = InferSchemaType<typeof EventCommentSchema>;

const EventCommentModel =
  (models.EventComment as Model<EventComment>) ||
  model<EventComment>("EventComment", EventCommentSchema);

export default EventCommentModel;
