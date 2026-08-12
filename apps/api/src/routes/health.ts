import { Router } from "express";
import mongoose from "mongoose";
import { githubOAuthEnabled, isMemoryRedis } from "../config/env.js";
import { pingRedis } from "../lib/redis.js";

export const healthRouter = Router();

healthRouter.get("/healthz", async (_req, res) => {
  const dbOk = mongoose.connection.readyState === 1;
  const redisOk = await pingRedis();
  const status = dbOk && redisOk ? "ok" : "degraded";
  res.status(status === "ok" ? 200 : 503).json({ status, db: dbOk ? "up" : "down", redis: redisOk ? "up" : "down" });
});

healthRouter.get("/api/health", async (_req, res) => {
  res.json({
    name: "PARALLAX",
    version: "0.1.0",
    mode: githubOAuthEnabled ? "github" : "mock",
    githubOAuthEnabled,
    memoryRedis: isMemoryRedis,
    uptime: Math.round(process.uptime()),
  });
});
