import type { GitHubCommitDTO } from "./types.js";

export function classifyCommit(message: string): GitHubCommitDTO["classification"] {
  const lower = message.toLowerCase();
  if (lower.startsWith("fix") || lower.startsWith("hotfix") || lower.includes("resolve")) return "bugfix";
  if (lower.startsWith("feat") || lower.includes("implement") || lower.startsWith("add ")) return "feature";
  if (lower.includes("refactor") || lower.includes("extract") || lower.includes("migrate")) return "refactor";
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("adr")) return "docs";
  if (lower.includes("test")) return "tests";
  if (lower.includes("bump") || lower.includes("upgrade") || lower.includes("pin") || lower.includes("dep")) return "dependency";
  return "chore";
}
