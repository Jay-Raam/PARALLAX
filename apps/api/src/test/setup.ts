import { connectDatabase, disconnectDatabase } from "../db/index.js";
import "../models/index.js";
import { User } from "../models/user.js";
import { Workspace, WorkspaceMember } from "../models/workspace.js";
import { Repository } from "../models/repository.js";
import { SyncJob } from "../models/syncJob.js";
import { syncService } from "../services/syncService.js";
import { healthService } from "../services/healthService.js";
import { createMockGitHubClient } from "../services/github/index.js";

export interface TestFixture {
  userId: string;
  workspaceId: string;
  repositoryIds: string[];
  cleanup: () => Promise<void>;
}

let fixture: TestFixture | null = null;

/** Connect to an in-memory database and seed a compact demo workspace. */
export async function setupTestDatabase(): Promise<TestFixture> {
  if (fixture) return fixture;

  await connectDatabase();

  let user = await User.findOne({ email: "test@parallax.dev" }).lean().exec();
  if (!user) {
    const created = await User.create({ email: "test@parallax.dev", name: "Test User" });
    user = await User.findById(created._id).lean().exec();
  }
  let workspace = await WorkspaceMember.findOne({ userId: user!._id })
    .lean()
    .exec()
    .then(async (m) => (m ? Workspace.findById(m.workspaceId).lean().exec() : null));
  if (!workspace) {
    const created = await Workspace.create({ name: "Test Workspace", slug: "test-workspace", ownerId: user!._id, settings: {} });
    await WorkspaceMember.create({ workspaceId: created._id, userId: user!._id, role: "OWNER" });
    workspace = await Workspace.findById(created._id).lean().exec();
  }
  workspace = workspace!;

  const client = createMockGitHubClient();
  const available = await client.listRepositories();
  const repositoryIds: string[] = [];

  for (const meta of available.slice(0, 3)) {
    const repo = await Repository.findOne({ workspaceId: String(workspace._id), githubId: meta.githubId }).lean().exec();
    let repositoryId: string;
    if (repo) {
      repositoryId = String(repo._id);
    } else {
      const created = await Repository.create({
        workspaceId: String(workspace._id),
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
      repositoryId = String(created._id);
    }

    const job = await SyncJob.create({
      workspaceId: String(workspace._id),
      repositoryId,
      type: "FULL",
      status: "RUNNING",
      triggeredBy: "MANUAL",
      progress: { phase: "test", current: 0, total: 0, percent: 0 },
      startedAt: new Date(),
    });
    await syncService.runRepositorySync(job, client);
    await healthService.computeForRepository({ repositoryId, workspaceId: String(workspace._id) });
    repositoryIds.push(repositoryId);
  }

  fixture = {
    userId: String(user!._id),
    workspaceId: String(workspace._id),
    repositoryIds,
    cleanup: async () => {
      await disconnectDatabase();
      fixture = null;
    },
  };
  return fixture;
}

export async function teardownTestDatabase(): Promise<void> {
  if (fixture) {
    await fixture.cleanup();
  }
}
