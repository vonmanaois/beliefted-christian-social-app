import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

const EventRSVPSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["going", "interested", "not_going"],
      required: true,
    },
  },
  { timestamps: true }
);

EventRSVPSchema.index({ eventId: 1, userId: 1 }, { unique: true });
EventRSVPSchema.index({ eventId: 1, createdAt: -1 });
EventRSVPSchema.index({ userId: 1, createdAt: -1 });

export type EventRSVP = InferSchemaType<typeof EventRSVPSchema> & { _id: Types.ObjectId };

const EventRSVPModel =
  (models.EventRSVP as Model<EventRSVP>) || model<EventRSVP>("EventRSVP", EventRSVPSchema);

export default EventRSVPModel;
