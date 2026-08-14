import { describe, expect, it } from "vitest";
import { PullRequestRiskService } from "./riskService.js";

const service = new PullRequestRiskService();

describe("PullRequestRiskService", () => {
  it("scores a tiny, well-covered change as LOW", () => {
    const result = service.compute({
      additions: 12,
      deletions: 4,
      changedFiles: 1,
      files: ["src/lib/format.ts", "src/lib/__tests__/format.test.ts"],
      testFilesChanged: 1,
      dependenciesChanged: 0,
      authFilesChanged: 0,
      migrationFilesChanged: 0,
    });
    expect(result.score).toBeLessThan(25);
    expect(result.level).toBe("LOW");
    expect(result.factors).not.toContain("No test files changed");
  });

  it("flags authentication changes and missing tests as high risk", () => {
    const result = service.compute({
      additions: 900,
      deletions: 300,
      changedFiles: 24,
      files: ["src/auth/middleware.ts", "src/auth/session.ts", "src/payments/ledger.ts", "src/services/sync.ts"],
      testFilesChanged: 0,
      dependenciesChanged: 0,
      authFilesChanged: 1,
      migrationFilesChanged: 0,
    });
    expect(result.score).toBeGreaterThanOrEqual(50);
    expect(result.level).toMatch(/HIGH|CRITICAL/);
    expect(result.factors.some((f) => f.toLowerCase().includes("authentication"))).toBe(true);
    expect(result.factors).toContain("No test files changed");
  });

  it("adds migration and dependency penalties", () => {
    const base = service.compute({
      additions: 200,
      deletions: 40,
      changedFiles: 6,
      files: ["src/services/sync.ts"],
      testFilesChanged: 1,
      dependenciesChanged: 0,
      authFilesChanged: 0,
      migrationFilesChanged: 0,
    });
    const withMigration = service.compute({
      additions: 200,
      deletions: 40,
      changedFiles: 7,
      files: ["src/services/sync.ts", "migrations/001_initial.ts"],
      testFilesChanged: 1,
      dependenciesChanged: 1,
      authFilesChanged: 0,
      migrationFilesChanged: 1,
    });
    expect(withMigration.score).toBeGreaterThan(base.score);
    expect(withMigration.factors.some((f) => f.toLowerCase().includes("migration"))).toBe(true);
  });

  it("never exceeds 100 and always returns an explanation", () => {
    const result = service.compute({
      additions: 10_000,
      deletions: 5_000,
      changedFiles: 80,
      files: Array.from({ length: 80 }, (_, i) => `src/modules/module-${i}/index.ts`),
      testFilesChanged: 0,
      dependenciesChanged: 0,
      authFilesChanged: 0,
      migrationFilesChanged: 0,
    });
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.explanation).toContain(`Risk ${result.score}/100`);
  });

  it("classifies file lists", () => {
    const classified = service.classifyFiles([
      "src/auth/middleware.ts",
      "package.json",
      "src/services/__tests__/health.test.ts",
      "migrations/001.ts",
      "src/index.ts",
    ]);
    expect(classified.authFilesChanged).toBe(1);
    expect(classified.dependenciesChanged).toBe(1);
    expect(classified.testFilesChanged).toBe(1);
    expect(classified.migrationFilesChanged).toBe(1);
  });
});
