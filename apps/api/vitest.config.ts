import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    fileParallelism: false,
    env: {
      NODE_ENV: "test",
      MONGODB_URI: "mongodb-memory",
      REDIS_URL: "memory",
      WORKER_MODE: "embedded",
      SESSION_SECRET: "test-session-secret",
      LOG_LEVEL: "silent",
    },
  },
});
