import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { setupTestDatabase, teardownTestDatabase } from "../test/setup.js";
import { healthService } from "./healthService.js";
import { HealthScore } from "../models/health.js";

let fixture: Awaited<ReturnType<typeof setupTestDatabase>>;

beforeAll(async () => {
  fixture = await setupTestDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

describe("HealthService", () => {
  it("computes a weighted overall score with all nine categories", async () => {
    const result = await healthService.computeForRepository({
      repositoryId: fixture.repositoryIds[0]!,
      workspaceId: fixture.workspaceId,
    });

    expect(result.overall).toBeGreaterThanOrEqual(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    for (const key of ["codeQuality", "testing", "dependencies", "security", "documentation", "cicd", "activity", "issueHygiene", "releaseStability"]) {
      expect(result.breakdown[key]).toBeGreaterThanOrEqual(0);
      expect(result.breakdown[key]).toBeLessThanOrEqual(100);
    }
  });

  it("persists snapshots and builds a trend", async () => {
    const before = await healthService.getLatest(fixture.repositoryIds[0]!);
    expect(before).not.toBeNull();

    const trend = await healthService.getTrend(fixture.repositoryIds[0]!);
    expect(trend.length).toBeGreaterThanOrEqual(1);
    expect(trend[0]).toHaveProperty("score");

    const docs = await HealthScore.countDocuments({ repositoryId: fixture.repositoryIds[0]! });
    expect(docs).toBeGreaterThanOrEqual(1);
  });

  it("returns explanations and risks", async () => {
    const result = await healthService.computeForRepository({
      repositoryId: fixture.repositoryIds[1]!,
      workspaceId: fixture.workspaceId,
    });
    expect(Array.isArray(result.explanations)).toBe(true);
    expect(result.risks.length).toBeGreaterThanOrEqual(1);
  });

  it("aggregates workspace-level health", async () => {
    const { health, change } = await healthService.workspaceHealth(fixture.workspaceId);
    expect(health).toBeGreaterThanOrEqual(0);
    expect(health).toBeLessThanOrEqual(100);
    expect(typeof change).toBe("number");
  });
});
