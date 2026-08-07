import mongoose, { model, type Model, type Schema } from "mongoose";

/**
 * Create (or reuse) a typed Mongoose model without tripping over mongoose 8's
 * `model<T extends Schema>` overload. Returns Model<DocType>.
 */
export function typedModel<T>(name: string, schema: Schema<T>): Model<T> {
  const existing = (mongoose.models as Record<string, Model<T> | undefined>)[name];
  if (existing) return existing;
  return model(name, schema as never) as Model<T>;
}
