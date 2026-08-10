import { riskLevelForScore } from "@parallax/shared";
import { clamp } from "@parallax/shared";

export interface PRRiskInput {
  additions: number;
  deletions: number;
  changedFiles: number;
  files: string[];
  testFilesChanged: number;
  dependenciesChanged: number;
  authFilesChanged: number;
  migrationFilesChanged: number;
}

export interface PRRiskResult {
  score: number;
  level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  factors: string[];
  explanation: string;
}

const AUTH_PATTERNS = [/auth/, /session/, /oauth/, /rbac/, /permission/i];
const SECURITY_PATTERNS = [/payment/, /security/, /crypto/, /ledger/, /secret/, /settlement/i];
const MIGRATION_PATTERNS = [/migration/, /migrate/];
const TEST_PATTERNS = [/__tests__/, /\.test\./, /\.spec\./, /test\//, /testing/];
const CRITICAL_MODULES = [/src\/index\./, /src\/app\./, /src\/config\/env/, /lib\/errors/, /server\.ts/, /main\.ts/];

/**
 * Deterministic, explainable PR risk scoring.
 * Base score comes from diff size; adders are applied for high-signal changes.
 */
export class PullRequestRiskService {
  compute(input: PRRiskInput): PRRiskResult {
    const totalDiff = input.additions + input.deletions;
    const factors: string[] = [];
    let score = 0;

    // Large diff
    if (totalDiff > 1200) {
      score += 38;
      factors.push("Very large diff (>1200 lines changed)");
    } else if (totalDiff > 600) {
      score += 28;
      factors.push("Large diff (600-1200 lines changed)");
    } else if (totalDiff > 300) {
      score += 18;
      factors.push("Substantial diff (300-600 lines changed)");
    } else if (totalDiff > 100) {
      score += 10;
      factors.push("Moderate diff (100-300 lines changed)");
    } else {
      score += 5;
    }

    // Many files
    if (input.changedFiles > 20) {
      score += 15;
      factors.push("More than 20 files changed");
    } else if (input.changedFiles > 10) {
      score += 10;
      factors.push("More than 10 files changed");
    } else if (input.changedFiles > 5) {
      score += 5;
    }

    // Authentication changes
    if (input.authFilesChanged > 0 || input.files.some((f) => AUTH_PATTERNS.some((p) => p.test(f)))) {
      score += 18;
      factors.push("Authentication / authorization code modified");
    }

    // Security-sensitive changes
    if (input.files.some((f) => SECURITY_PATTERNS.some((p) => p.test(f)))) {
      score += 12;
      factors.push("Security-sensitive module modified (payments, secrets, ledger)");
    }

    // Database migrations
    if (input.migrationFilesChanged > 0 || input.files.some((f) => MIGRATION_PATTERNS.some((p) => p.test(f)))) {
      score += 12;
      factors.push("Database migration included");
    }

    // Dependency changes
    if (input.dependenciesChanged > 0) {
      score += 10;
      factors.push("Dependency versions changed");
    }

    // No test coverage
    if (input.testFilesChanged === 0 && !input.files.some((f) => TEST_PATTERNS.some((p) => p.test(f)))) {
      score += 14;
      factors.push("No test files changed");
    }

    // Critical modules
    if (input.files.some((f) => CRITICAL_MODULES.some((p) => p.test(f)))) {
      score += 8;
      factors.push("Entrypoint or core module modified");
    }

    // Multiple modules affected
    const topLevelModules = new Set(
      input.files
        .map((f) => f.split("/")[0])
        .filter((part) => part && !part.startsWith(".") && part !== "package.json" && part !== "tsconfig.json"),
    );
    if (topLevelModules.size > 3) {
      score += 6;
      factors.push("Multiple modules affected");
    }

    const clamped = clamp(score, 0, 100);
    return {
      score: Math.round(clamped),
      level: riskLevelForScore(clamped),
      factors,
      explanation: this.buildExplanation(clamped, factors),
    };
  }

  private buildExplanation(score: number, factors: string[]): string {
    const level = riskLevelForScore(score);
    const top = factors.slice(0, 3).map((f) => f.toLowerCase()).join(", ");
    return `Risk ${score}/100 (${level}). ${top ? `Main drivers: ${top}.` : "Small, low-risk change."}`;
  }

  /** Compute the risk signal for a PR file list (used when PRs lack explicit risk). */
  classifyFiles(files: string[]): {
    testFilesChanged: number;
    dependenciesChanged: number;
    authFilesChanged: number;
    migrationFilesChanged: number;
  } {
    return {
      testFilesChanged: files.filter((f) => TEST_PATTERNS.some((p) => p.test(f))).length,
      dependenciesChanged: files.filter((f) => /package(?:-lock)?\.json|pnpm-lock\.yaml|requirements\.txt|go\.mod/.test(f)).length,
      authFilesChanged: files.filter((f) => AUTH_PATTERNS.some((p) => p.test(f))).length,
      migrationFilesChanged: files.filter((f) => MIGRATION_PATTERNS.some((p) => p.test(f))).length,
    };
  }
}

export const prRiskService = new PullRequestRiskService();
