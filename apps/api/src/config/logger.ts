import pino, { multistream } from "pino";
import { env } from "./env.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logDir = path.resolve(__dirname, "../../logs");

try {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
} catch (e) {
  console.error("Failed to create log directory:", e);
}

const logFilePath = path.join(logDir, "app.log");

const streams = [
  { stream: process.stdout },
  { stream: fs.createWriteStream(logFilePath, { flags: "a" }) }
];

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "parallax-api",
    env: env.NODE_ENV,
  },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "req.headers['x-hub-signature-256']",
      "*.accessToken",
      "*.access_token",
      "*.password",
      "*.secret",
      "*.token",
      "*.encryptedToken",
      "headers['set-cookie']",
    ],
    censor: "[REDACTED]",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
}, multistream(streams));

export type Logger = typeof logger;

