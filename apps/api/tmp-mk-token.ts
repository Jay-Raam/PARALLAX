import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const rootEnv = resolve(process.cwd(), "../../.env");
if (existsSync(rootEnv)) loadEnvFile(rootEnv);
const { createHandoffToken } = await import("./src/lib/session.ts");
process.stdout.write(createHandoffToken("6a7dd5f3c09c2689698e2df3", "6a7dd5f3c09c2689698e2dfa"));
