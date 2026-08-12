import { connectDatabase, disconnectDatabase } from "../db/index.js";
import "../models/index.js";
import { User } from "../models/user.js";
import { Workspace, WorkspaceMember } from "../models/workspace.js";
import { Repository } from "../models/repository.js";
import { SyncJob } from "../models/syncJob.js";
import { healthService } from "../services/healthService.js";
import { recommendationService } from "../services/recommendationService.js";
import { syncService } from "../services/syncService.js";
import { notificationService } from "../services/notificationService.js";
import { createMockGitHubClient } from "../services/github/index.js";
import { logger } from "../config/logger.js";

const DEMO_EMAIL = "jay@parallax.dev";

async function main() {
  await connectDatabase();
  logger.info("Seeding PARALLAX demo workspace…");

  const start = Date.now();

  let user = await User.findOne({ email: DEMO_EMAIL }).lean().exec();
  if (!user) {
    const created = await User.create({ email: DEMO_EMAIL, name: "Jay Ram", githubLogin: "jayraam" });
    user = await User.findById(created._id).lean().exec();
    logger.info({ email: DEMO_EMAIL }, "Created demo user");
  }
  user = user!;

  let workspace = await WorkspaceMember.findOne({ userId: user!._id })
    .lean()
    .exec()
    .then(async (m) => (m ? Workspace.findById(m.workspaceId).lean().exec() : null));
  if (!workspace) {
    const created = await Workspace.create({
      name: "Demo Workspace",
      slug: "demo-workspace",
      ownerId: user!._id,
      settings: { defaultBranch: "main", timezone: "UTC", syncIntervalMinutes: 60, healthThreshold: 70 },
    });
    await WorkspaceMember.create({ workspaceId: created._id, userId: user!._id, role: "OWNER" });
    workspace = await Workspace.findById(created._id).lean().exec();
    logger.info("Created demo workspace");
  }
  workspace = workspace!;

  const client = createMockGitHubClient();
  const available = await client.listRepositories();
  logger.info({ repositories: available.length }, "Connecting repositories");

  const workspaceId = String(workspace._id);
  const connected: string[] = [];

  for (const meta of available) {
    const existing = await Repository.findOne({ workspaceId, githubId: meta.githubId }).lean().exec();
    let repo = existing;
    if (!repo) {
      const created = await Repository.create({
        workspaceId,
        githubId: meta.githubId,
        name: meta.name,
        fullName: meta.fullName,
        owner: meta.owner,
        description: meta.description,
        url: meta.url,
        defaultBranch: meta.defaultBranch,
        isPrivate: meta.isPrivate,
        language: meta.language,
        techStack: meta.techStack,
        topics: meta.topics,
        fork: false,
        archived: false,
        createdAt: new Date(meta.createdAt),
        pushedAt: meta.pushedAt ? new Date(meta.pushedAt) : undefined,
        starCount: meta.starCount,
        forkCount: meta.forkCount,
        openIssuesCount: meta.openIssuesCount,
        syncStatus: "NOT_SYNCED",
        enabled: true,
        source: "mock",
        lastActivityAt: meta.pushedAt ? new Date(meta.pushedAt) : undefined,
      });
      repo = await Repository.findById(created._id).lean().exec();
    }
    repo = repo!;

    const repositoryId = String(repo._id);
    connected.push(repositoryId);

    // Full sync through the real pipeline (idempotent upserts)
    const job = await SyncJob.create({
      workspaceId,
      repositoryId,
      type: "FULL",
      status: "RUNNING",
      triggeredBy: "MANUAL",
      progress: { phase: "seeding", current: 0, total: 0, percent: 0 },
      startedAt: new Date(),
    });
    try {
      const { stats } = await syncService.runRepositorySync(job, client);
      await SyncJob.updateOne(
        { _id: job._id },
        { $set: { status: "COMPLETED", stats, completedAt: new Date(), progress: { phase: "complete", current: stats.total ?? 0, total: stats.total ?? 0, percent: 100 } } },
      ).exec();
      logger.info({ repo: meta.name, stats }, "Seeded repository");
    } catch (err) {
      logger.error({ repo: meta.name, err: (err as Error).message }, "Seed sync failed for repository");
      await SyncJob.updateOne({ _id: job._id }, { $set: { status: "FAILED", error: (err as Error).message } }).exec();
    }
  }

  logger.info("Building daily metrics and health scores…");
  for (const repositoryId of connected) {
    await syncService.buildDailyMetrics(repositoryId, workspaceId);
    await healthService.computeForRepository({ repositoryId, workspaceId });
  }

  logger.info("Generating recommendations…");
  const recommendations = await recommendationService.generateForWorkspace(workspaceId);
  await recommendationService.notifyForNewHighPriority(workspaceId, recommendations);

  // Welcome notification
  await notificationService.create({
    workspaceId,
    type: "SYNC_COMPLETE",
    severity: "INFO",
    title: "Your engineering workspace is ready",
    body: "8 repositories analyzed. Explore health, risk, and recommendations.",
    url: "/overview",
    dedupeKey: "seed-welcome",
  });

  const elapsed = Math.round((Date.now() - start) / 1000);
  logger.info({ elapsedSeconds: elapsed, repositories: connected.length, recommendations: recommendations.length }, "Demo workspace seeded successfully");

  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  logger.fatal({ err: (err as Error).message }, "Seeding failed");
  process.exit(1);
});
