import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true, index: true },
    image: { type: String, trim: true },
  },
  { timestamps: true }
);

export type User = InferSchemaType<typeof UserSchema>;

const UserModel = (models.User as Model<User>) || model<User>("User", UserSchema);

export default UserModel;
