import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

const EventSchema = new Schema(
  {
    title: { type: String, trim: true, maxlength: 120, required: true },
    description: { type: String, trim: true, maxlength: 2000 },
    startAt: { type: Date, required: true },
    endAt: { type: Date },
    locationText: { type: String, trim: true, maxlength: 200 },
    posterImage: { type: String, trim: true },
    visibility: { type: String, enum: ["public", "followers", "private"], default: "public" },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    capacity: { type: Number, min: 1, max: 100000 },
    goingCount: { type: Number, default: 0 },
    interestedCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

EventSchema.index({ startAt: 1 });
EventSchema.index({ createdAt: -1 });
EventSchema.index({ hostId: 1, createdAt: -1 });
EventSchema.index({ visibility: 1, startAt: 1 });

export type Event = InferSchemaType<typeof EventSchema> & { _id: Types.ObjectId };

const EventModel = (models.Event as Model<Event>) || model<Event>("Event", EventSchema);

export default EventModel;
