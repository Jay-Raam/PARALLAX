import DataLoader from "dataloader";
import { Types } from "mongoose";
import { Contributor } from "../models/contributor.js";
import { HealthScore } from "../models/health.js";
import { PullRequest, PullRequestReview } from "../models/pullRequest.js";
import { Repository } from "../models/repository.js";
import { User } from "../models/user.js";
import { Workspace } from "../models/workspace.js";

function oid(id: string): Types.ObjectId {
  return new Types.ObjectId(id);
}

export interface Loaders {
  userById: DataLoader<string, unknown>;
  workspaceById: DataLoader<string, unknown>;
  repositoryById: DataLoader<string, unknown>;
  repositoryHealth: DataLoader<string, unknown>;
  repositoryCounts: DataLoader<string, unknown>;
  prReviews: DataLoader<string, unknown>;
  prAuthor: DataLoader<string, unknown>;
  contributorByRepoAndLogin: DataLoader<string, unknown>;
}

export function createLoaders(): Loaders {
  return {
    userById: new DataLoader<string, unknown>(async (ids) => {
      const users = await User.find({ _id: { $in: ids.map(oid) } }).lean().exec();
      const map = new Map(users.map((u) => [String(u._id), u]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    workspaceById: new DataLoader<string, unknown>(async (ids) => {
      const workspaces = await Workspace.find({ _id: { $in: ids.map(oid) } }).lean().exec();
      const map = new Map(workspaces.map((w) => [String(w._id), w]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    repositoryById: new DataLoader<string, unknown>(async (ids) => {
      const repos = await Repository.find({ _id: { $in: ids.map(oid) } }).lean().exec();
      const map = new Map(repos.map((r) => [String(r._id), r]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    repositoryHealth: new DataLoader<string, unknown>(async (ids) => {
      const docs = await HealthScore.aggregate<{ _id: string; overall: number; change: number; computedAt: Date }>([
        { $match: { repositoryId: { $in: ids.map(oid) } } },
        { $sort: { computedAt: -1 } },
        { $group: { _id: "$repositoryId", overall: { $first: "$overall" }, change: { $first: "$change" }, computedAt: { $first: "$computedAt" } } },
      ]);
      const map = new Map(docs.map((d) => [String(d._id), d]));
      return ids.map((id) => map.get(id) ?? null);
    }),

    repositoryCounts: new DataLoader<string, unknown>(async (ids) => {
      const { Commit } = await import("../models/commit.js");
      const { Dependency } = await import("../models/dependency.js");
      const { Deployment } = await import("../models/deployment.js");
      const { Issue } = await import("../models/issue.js");
      const { Release } = await import("../models/release.js");
      const { SecurityAlert } = await import("../models/securityAlert.js");
      const inIds = ids.map(oid);

      const [commits, openPrs, mergedPrs, openIssues, closedIssues, deps, outdatedDeps, alerts, deployments, releases, contributors] =
        await Promise.all([
          Commit.aggregate([{ $match: { repositoryId: { $in: inIds } } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          PullRequest.aggregate([{ $match: { repositoryId: { $in: inIds }, state: "OPEN" } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          PullRequest.aggregate([{ $match: { repositoryId: { $in: inIds }, state: "MERGED" } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Issue.aggregate([{ $match: { repositoryId: { $in: inIds }, state: "OPEN" } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Issue.aggregate([{ $match: { repositoryId: { $in: inIds }, state: "CLOSED" } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Dependency.aggregate([{ $match: { repositoryId: { $in: inIds } } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Dependency.aggregate([{ $match: { repositoryId: { $in: inIds }, outdated: true } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          SecurityAlert.aggregate([{ $match: { repositoryId: { $in: inIds }, state: "OPEN" } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Deployment.aggregate([{ $match: { repositoryId: { $in: inIds } } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Release.aggregate([{ $match: { repositoryId: { $in: inIds } } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
          Contributor.aggregate([{ $match: { repositoryId: { $in: inIds } } }, { $group: { _id: "$repositoryId", count: { $sum: 1 } } }]),
        ]);

      const toMap = (rows: { _id: Types.ObjectId; count: number }[]) =>
        new Map(rows.map((r) => [String(r._id), r.count]));

      const m = {
        commits: toMap(commits),
        openPrs: toMap(openPrs),
        mergedPrs: toMap(mergedPrs),
        openIssues: toMap(openIssues),
        closedIssues: toMap(closedIssues),
        deps: toMap(deps),
        outdatedDeps: toMap(outdatedDeps),
        alerts: toMap(alerts),
        deployments: toMap(deployments),
        releases: toMap(releases),
        contributors: toMap(contributors),
      };

      return ids.map((id) => ({
        commits: m.commits.get(id) ?? 0,
        openPrs: m.openPrs.get(id) ?? 0,
        mergedPrs: m.mergedPrs.get(id) ?? 0,
        openIssues: m.openIssues.get(id) ?? 0,
        closedIssues: m.closedIssues.get(id) ?? 0,
        dependencies: m.deps.get(id) ?? 0,
        outdatedDependencies: m.outdatedDeps.get(id) ?? 0,
        securityAlerts: m.alerts.get(id) ?? 0,
        deployments: m.deployments.get(id) ?? 0,
        releases: m.releases.get(id) ?? 0,
        contributors: m.contributors.get(id) ?? 0,
      }));
    }),

    prReviews: new DataLoader<string, unknown>(async (ids) => {
      const reviews = await PullRequestReview.find({ pullRequestId: { $in: ids.map(oid) } })
        .sort({ submittedAt: 1 })
        .lean()
        .exec();
      const map = new Map<string, unknown[]>();
      for (const review of reviews) {
        const key = String(review.pullRequestId);
        const list = (map.get(key) as unknown[]) ?? [];
        list.push(review);
        map.set(key, list);
      }
      return ids.map((id) => map.get(id) ?? []);
    }),

    prAuthor: new DataLoader<string, unknown>(async (ids) => {
      const prs = await PullRequest.find({ _id: { $in: ids.map(oid) } }).select("repositoryId authorLogin").lean().exec();
      const pairs = prs.map((p) => ({ key: String(p._id), repositoryId: String(p.repositoryId), login: p.authorLogin }));
      const contributors = await Contributor.find({
        $or: pairs.map((p) => ({ repositoryId: p.repositoryId, login: p.login })),
      })
        .lean()
        .exec();
      const map = new Map(contributors.map((c) => [`${String(c.repositoryId)}:${c.login}`, c]));
      return ids.map((id) => {
        const pair = pairs.find((p) => p.key === id);
        return pair ? (map.get(`${pair.repositoryId}:${pair.login}`) ?? null) : null;
      });
    }),

    contributorByRepoAndLogin: new DataLoader<string, unknown>(async (keys) => {
      const pairs = keys.map((key) => {
        const [repositoryId, login] = key.split(":");
        return { repositoryId, login };
      });
      const contributors = await Contributor.find({
        $or: pairs.map((p) => ({ repositoryId: p.repositoryId, login: p.login })),
      })
        .lean()
        .exec();
      const map = new Map(contributors.map((c) => [`${String(c.repositoryId)}:${c.login}`, c]));
      return keys.map((key) => map.get(key) ?? null);
    }),
  };
}
