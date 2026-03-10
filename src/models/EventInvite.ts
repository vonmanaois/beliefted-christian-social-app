import { Schema, model, models, type Model, type InferSchemaType, Types } from "mongoose";

const EventInviteSchema = new Schema(
  {
    eventId: { type: Schema.Types.ObjectId, ref: "Event", required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined"],
      default: "pending",
    },
  },
  { timestamps: true }
);

EventInviteSchema.index({ eventId: 1, inviteeId: 1 }, { unique: true });
EventInviteSchema.index({ inviteeId: 1, createdAt: -1 });
EventInviteSchema.index({ inviterId: 1, createdAt: -1 });

export type EventInvite = InferSchemaType<typeof EventInviteSchema> & { _id: Types.ObjectId };

const EventInviteModel =
  (models.EventInvite as Model<EventInvite>) || model<EventInvite>("EventInvite", EventInviteSchema);

export default EventInviteModel;
