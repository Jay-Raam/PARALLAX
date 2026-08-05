import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { z } from "zod";

// Load the monorepo-root .env (the file the user edits). Explicit env vars
// always win — loadEnvFile only fills variables that aren't already set.
if (process.env.NODE_ENV !== "test") {
  const envPath = fileURLToPath(new URL("../../../../.env", import.meta.url));
  if (existsSync(envPath)) {
    loadEnvFile(envPath);
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Fall back to 4000 when an invalid PORT is exported (e.g. PORT=0 in some shells/CI) instead of crashing config parse.
  PORT: z.coerce.number().int().positive().default(4000).catch(4000),

  MONGODB_URI: z.string().default("mongodb://localhost:27017/parallax"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  GITHUB_CLIENT_ID: z.string().default(""),
  GITHUB_CLIENT_SECRET: z.string().default(""),
  GITHUB_OAUTH_REDIRECT_URI: z.string().default("http://localhost:4000/auth/github/callback"),
  GITHUB_WEBHOOK_SECRET: z.string().default(""),

  SESSION_SECRET: z.string().default("parallax-dev-secret-change-me"),
  ENCRYPTION_KEY: z.string().default(""),

  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  WORKER_MODE: z.enum(["embedded", "separate"]).default("embedded"),
  GRAPHQL_MAX_DEPTH: z.coerce.number().int().positive().default(12),
  GRAPHQL_MAX_COMPLEXITY: z.coerce.number().int().positive().default(600),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
});

function parseEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
    throw new Error("Invalid environment configuration");
  }
  return parsed.data;
}

export type Env = ReturnType<typeof parseEnv>;

export const env = parseEnv();

export const isMemoryMode = env.MONGODB_URI === "mongodb-memory";
export const isMemoryRedis = env.REDIS_URL === "memory";
export const isTest = env.NODE_ENV === "test";
export const isProduction = env.NODE_ENV === "production";

export const githubOAuthEnabled = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
