import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import mongoose from "mongoose";

const rootEnv = resolve(process.cwd(), ".env");
if (existsSync(rootEnv)) loadEnvFile(rootEnv);

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("MONGODB_URI not found");
  process.exit(1);
}

async function run() {
  await mongoose.connect(MONGODB_URI!);

  const jobs = await mongoose.connection.db.collection("syncjobs")
    .find({ createdAt: { $gte: new Date("2026-08-13T18:11:00.000Z") } })
    .sort({ createdAt: 1 })
    .toArray();
  
  console.log("Current Run Jobs:", jobs.map(j => ({
    id: j._id,
    repoId: j.repositoryId,
    status: j.status,
    phase: j.progress?.phase,
    percent: j.progress?.percent,
    current: j.progress?.current,
    total: j.progress?.total,
    error: j.error,
    updatedAt: j.updatedAt
  })));

  await mongoose.disconnect();
}

run().catch(console.error);
