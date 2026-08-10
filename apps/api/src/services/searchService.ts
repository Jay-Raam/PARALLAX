import { Types } from "mongoose";
import { Commit } from "../models/commit.js";
import { Contributor } from "../models/contributor.js";
import { Dependency } from "../models/dependency.js";
import { Deployment } from "../models/deployment.js";
import { Issue } from "../models/issue.js";
import { PullRequest } from "../models/pullRequest.js";
import { Recommendation } from "../models/recommendation.js";
import { Repository } from "../models/repository.js";

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export class SearchService {
  async search(workspaceId: string, query: string, limit = 6) {
    const pattern = escapeRegex(query.trim());
    const repoRegex = new RegExp(pattern, "i");
    const textRegex = new RegExp(pattern, "i");
    const numberMatch = /^#?(\d+)$/.exec(query.trim());

    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
    const repoIds = repos.map((r) => r._id.toString());
    const inRepos = { repositoryId: { $in: repoIds.map((id) => new Types.ObjectId(id)) } };
    const numberCondition = numberMatch ? [{ githubNumber: Number(numberMatch[1]) }] : [];

    const [prs, issues, commits, dependencies, deployments, contributors, recommendations] =
      await Promise.all([
        PullRequest.find({ ...inRepos, $or: [{ title: textRegex }, ...numberCondition] })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),
        Issue.find({ ...inRepos, $or: [{ title: textRegex }, ...numberCondition] })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),
        Commit.find({ ...inRepos, messageTitle: textRegex })
          .sort({ date: -1 })
          .limit(limit)
          .lean()
          .exec(),
        Dependency.find({ ...inRepos, name: textRegex }).limit(limit).lean().exec(),
        Deployment.find({ ...inRepos, $or: [{ environment: textRegex }, { version: textRegex }] })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),
        Contributor.find({ ...inRepos, login: textRegex }).sort({ commits: -1 }).limit(limit).lean().exec(),
        Recommendation.find({ workspaceId, $or: [{ title: textRegex }, { reason: textRegex }] })
          .sort({ createdAt: -1 })
          .limit(limit)
          .lean()
          .exec(),
      ]);

    const matchingRepos = await Repository.find({
      workspaceId,
      enabled: true,
      $or: [{ name: repoRegex }, { fullName: repoRegex }],
    })
      .sort({ starCount: -1 })
      .limit(limit)
      .lean()
      .exec();

    return {
      repositories: matchingRepos,
      pullRequests: prs,
      issues,
      commits,
      dependencies,
      deployments,
      contributors,
      recommendations,
    };
  }
}

export const searchService = new SearchService();
