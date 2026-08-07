import { Schema } from "mongoose";
import { typedModel } from "./helpers.js";

export interface UserDoc {
  _id: Schema.Types.ObjectId;
  email: string;
  name: string;
  avatarUrl?: string;
  githubLogin?: string;
  githubId?: number;
  lastSeenAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String },
    githubLogin: { type: String, index: true },
    githubId: { type: Number, index: true },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

export const User = typedModel<UserDoc>("User", userSchema);
