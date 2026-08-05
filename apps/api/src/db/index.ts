import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { env, isMemoryMode, isTest } from "../config/env.js";
import { logger } from "../config/logger.js";

let memoryServer: MongoMemoryServer | null = null;

export async function connectDatabase(): Promise<{ uri: string; memory: boolean }> {
  let uri = env.MONGODB_URI;
  let memory = false;

  if (isMemoryMode || isTest) {
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri("parallax");
    memory = true;
  }

  mongoose.set("strictQuery", true);
  if (!isTest) {
    mongoose.set("debug", false);
  }

  await mongoose.connect(uri, {
    maxPoolSize: isTest ? 5 : 20,
    serverSelectionTimeoutMS: 15_000,
  });

  logger.info({ uri: memory ? "mongodb-memory" : redactUri(uri), memory }, "Connected to MongoDB");
  return { uri, memory };
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

function redactUri(uri: string): string {
  try {
    const u = new URL(uri);
    if (u.username) u.username = "***";
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return uri.replace(/\/\/[^@]+@/, "//***:***@");
  }
}
