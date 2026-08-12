import { connectDatabase } from "../db/index.js";
import { closeRedis } from "../lib/redis.js";
import { logger } from "../config/logger.js";
import "../models/index.js";
import { registerProcessors } from "./processors.js";

async function main() {
  await connectDatabase();
  registerProcessors();
  logger.info("PARALLAX worker started");

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Worker shutting down");
    await closeRedis();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "Worker failed to start");
  process.exit(1);
});
