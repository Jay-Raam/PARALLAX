import type { Priority } from "@parallax/shared";
import { Commit } from "../models/commit.js";
import { Dependency } from "../models/dependency.js";
import { Deployment } from "../models/deployment.js";
import { Issue } from "../models/issue.js";
import { PullRequest } from "../models/pullRequest.js";
import { Recommendation, type RecommendationDoc } from "../models/recommendation.js";
import { Repository } from "../models/repository.js";
import { SecurityAlert } from "../models/securityAlert.js";
import { analyticsService } from "./analyticsService.js";
import { notificationService } from "./notificationService.js";
import { formatDurationMs } from "@parallax/shared";
import { daysSince } from "@parallax/shared";

interface DraftRecommendation {
  type: RecommendationDoc["type"];
  repositoryId?: string;
  priority: Priority;
  title: string;
  reason: string;
  evidence: Record<string, unknown>;
  impact: string;
  suggestedAction: string;
  dedupeKey: string;
}

export class RecommendationService {
  async generateForWorkspace(workspaceId: string): Promise<RecommendationDoc[]> {
    const repos = await Repository.find({ workspaceId, enabled: true }).select("_id").lean().exec();
    const drafts: DraftRecommendation[] = [];

    for (const repo of repos) {
      const repositoryId = repo._id.toString();
      drafts.push(...(await this.generateForRepository(workspaceId, repositoryId)));
    }

    drafts.push(...(await this.generateWorkspaceLevel(workspaceId)));

    const saved: RecommendationDoc[] = [];
    for (const draft of drafts) {
      const doc = await Recommendation.findOneAndUpdate(
        { workspaceId, repositoryId: draft.repositoryId ?? null, dedupeKey: draft.dedupeKey },
        {
          $set: {
            type: draft.type,
            priority: draft.priority,
            title: draft.title,
            reason: draft.reason,
            evidence: draft.evidence,
            impact: draft.impact,
            suggestedAction: draft.suggestedAction,
            status: "ACTIVE",
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      )
        .lean()
        .exec();
      saved.push(doc);
    }
    return saved;
  }

  private async generateForRepository(workspaceId: string, repositoryId: string): Promise<DraftRecommendation[]> {
    const drafts: DraftRecommendation[] = [];
    const now = Date.now();

    /* Dependency drift */
    const deps = await Dependency.find({ repositoryId }).lean().exec();
    const majorOutdated = deps.filter((d) => d.outdated && (d.updateType === "MAJOR" || d.risk === "HIGH" || d.risk === "CRITICAL"));
    for (const dep of majorOutdated.slice(0, 3)) {
      drafts.push({
        type: "DEPENDENCY_UPDATE",
        repositoryId,
        priority: dep.risk === "CRITICAL" ? "CRITICAL" : "HIGH",
        title: `Upgrade ${dep.name} from ${dep.currentVersion} to ${dep.latestVersion}`,
        reason: `${dep.name} is ${dep.updateType.toLowerCase()} versions behind with a ${dep.risk.toLowerCase()} upgrade risk.`,
        evidence: {
          package: dep.name,
          currentVersion: dep.currentVersion,
          latestVersion: dep.latestVersion,
          updateType: dep.updateType,
          risk: dep.risk,
        },
        impact: "Removes dependency drift, reduces supply-chain risk, and unblocks related upgrades.",
        suggestedAction: `Plan an upgrade of ${dep.name} with a changelog review and regression tests.`,
        dedupeKey: `dep-update:${dep.name}`,
      });
    }

    /* Vulnerable dependencies */
    const vulnerable = deps.filter(
      (d) => d.vulnerabilities.length > 0 && (d.risk === "CRITICAL" || d.vulnerabilities.some((v) => v.severity === "CRITICAL" || v.severity === "HIGH")),
    );
    for (const dep of vulnerable.slice(0, 3)) {
      drafts.push({
        type: "SECURITY_VULNERABILITY",
        repositoryId,
        priority: dep.vulnerabilities.some((v) => v.severity === "CRITICAL") ? "CRITICAL" : "HIGH",
        title: `Security vulnerability in ${dep.name}`,
        reason: `${dep.name} has ${dep.vulnerabilities.length} known ${dep.vulnerabilities.some((v) => v.severity === "CRITICAL") ? "critical" : "high"} severity vulnerability${dep.vulnerabilities.length > 1 ? "ies" : ""}.`,
        evidence: { package: dep.name, vulnerabilities: dep.vulnerabilities },
        impact: "Exposes the system to known exploits in production.",
        suggestedAction: `Upgrade ${dep.name} to a patched version immediately.`,
        dedupeKey: `vuln:${dep.name}`,
      });
    }

    /* Security alerts */
    const openAlerts = await SecurityAlert.find({ repositoryId, state: "OPEN" }).lean().exec();
    const severeAlerts = openAlerts.filter((a) => a.severity === "CRITICAL" || a.severity === "HIGH");
    if (severeAlerts.length >= 2) {
      drafts.push({
        type: "SECURITY_POSTURE",
        repositoryId,
        priority: severeAlerts.some((a) => a.severity === "CRITICAL") ? "CRITICAL" : "HIGH",
        title: `${severeAlerts.length} high-severity security findings open`,
        reason: `${severeAlerts.length} open security alerts at ${severeAlerts.map((a) => a.severity).join(" and ")} severity across dependabot, secret scanning and code scanning.`,
        evidence: {
          count: severeAlerts.length,
          categories: [...new Set(severeAlerts.map((a) => a.type))],
          alerts: severeAlerts.slice(0, 5).map((a) => a.title),
        },
        impact: "Elevated risk of a security incident in production.",
        suggestedAction: "Triage the open findings in the Security Center and patch or dismiss with justification.",
        dedupeKey: "security-posture",
      });
    }

    /* Stale issues */
    const issues = await Issue.find({ repositoryId, state: "OPEN" }).select("githubNumber updatedAt createdAt labels title").lean().exec();
    const stale = issues.filter((i) => daysSince(i.updatedAt ?? i.createdAt) > 30).sort((a, b) => new Date(a.updatedAt ?? a.createdAt).getTime() - new Date(b.updatedAt ?? b.createdAt).getTime());
    if (stale.length >= 5) {
      drafts.push({
        type: "STALE_ISSUES",
        repositoryId,
        priority: stale.length >= 12 ? "HIGH" : "MEDIUM",
        title: `${stale.length} stale issues are piling up`,
        reason: `${stale.length} open issues have had no activity for over 30 days, the oldest being #${stale[0]!.githubNumber} (${daysSince(stale[0]!.updatedAt ?? stale[0]!.createdAt)} days inactive).`,
        evidence: {
          count: stale.length,
          oldest: stale.slice(0, 5).map((i) => ({ number: i.githubNumber, daysInactive: daysSince(i.updatedAt ?? i.createdAt), title: i.title })),
        },
        impact: "The backlog hides unresolved bugs and decaying requirements.",
        suggestedAction: "Triage stale issues: close duplicates, re-prioritize, or assign owners.",
        dedupeKey: "stale-issues",
      });
    }

    /* Testing gaps */
    const recentPrs = await PullRequest.find({
      repositoryId,
      state: "MERGED",
      mergedAt: { $gte: new Date(now - 60 * 86_400_000) },
    })
      .select("testFilesChanged files")
      .lean()
      .exec();
    const untestedShare = recentPrs.length
      ? recentPrs.filter((p) => p.testFilesChanged === 0 && !(p.files ?? []).some((f) => f.includes("test"))).length / recentPrs.length
      : 0;
    if (untestedShare > 0.4 && recentPrs.length >= 5) {
      drafts.push({
        type: "TESTING_GAPS",
        repositoryId,
        priority: "MEDIUM",
        title: `${Math.round(untestedShare * 100)}% of merged pull requests lack test changes`,
        reason: `${Math.round(untestedShare * 100)}% of the last ${recentPrs.length} merged pull requests shipped without any test files.`,
        evidence: { untestedShare, mergedPrs: recentPrs.length },
        impact: "Regressions slip through and CI provides less protection.",
        suggestedAction: "Require test changes on PRs touching business logic; add coverage budgets to CI.",
        dedupeKey: "testing-gaps",
      });
    }

    /* Documentation inactivity */
    const docsCommits = await Commit.countDocuments({
      repositoryId,
      classification: "docs",
      date: { $gte: new Date(now - 60 * 86_400_000) },
    }).lean();
    if (docsCommits === 0) {
      drafts.push({
        type: "DOCUMENTATION_INACTIVITY",
        repositoryId,
        priority: "LOW",
        title: "No documentation changes in the last 60 days",
        reason: "No docs-classified commits were pushed in the last 60 days.",
        evidence: { daysWithoutDocs: 60 },
        impact: "Onboarding and operational knowledge decay over time.",
        suggestedAction: "Refresh README and architecture docs alongside the next feature release.",
        dedupeKey: "docs-inactivity",
      });
    }

    /* CI failures */
    const ci = await analyticsService.cicdAnalytics({ workspaceId, repositoryId }, "14D");
    if (ci.totalRuns >= 6 && ci.failedRuns >= 3 && ci.buildSuccessRate < 0.8) {
      drafts.push({
        type: "CI_FAILURES",
        repositoryId,
        priority: "MEDIUM",
        title: `CI failing ${Math.round((1 - ci.buildSuccessRate) * 100)}% of the time`,
        reason: `${ci.failedRuns} of the last ${ci.totalRuns} pipeline runs failed (success rate ${Math.round(ci.buildSuccessRate * 100)}%).`,
        evidence: { failedRuns: ci.failedRuns, totalRuns: ci.totalRuns, successRate: ci.buildSuccessRate },
        impact: "Unreliable CI blocks delivery and masks real regressions.",
        suggestedAction: "Investigate the most common failing pipeline stage and stabilize flaky tests.",
        dedupeKey: "ci-failures",
      });
    }

    /* Deployment failures */
    const deploys = await Deployment.find({
      repositoryId,
      createdAt: { $gte: new Date(now - 60 * 86_400_000) },
    })
      .select("status createdAt")
      .lean()
      .exec();
    const failedDeploys = deploys.filter((d) => d.status === "FAILURE");
    if (failedDeploys.length >= 2) {
      drafts.push({
        type: "DEPLOYMENT_FAILURES",
        repositoryId,
        priority: "HIGH",
        title: `${failedDeploys.length} failed deployments in the last 60 days`,
        reason: `${failedDeploys.length} of ${deploys.length} recent deployments failed.`,
        evidence: { failed: failedDeploys.length, total: deploys.length },
        impact: "Deployment failures cause downtime and erode release confidence.",
        suggestedAction: "Add canary checks, rollback automation, and post-deploy health assertions.",
        dedupeKey: "deployment-failures",
      });
    }

    return drafts;
  }

  private async generateWorkspaceLevel(workspaceId: string): Promise<DraftRecommendation[]> {
    const drafts: DraftRecommendation[] = [];

    /* Delivery bottleneck */
    const funnel = await analyticsService.deliveryAnalytics({ workspaceId }, "30D");
    const bottleneck = funnel.bottleneck;
    if (bottleneck && bottleneck.count > 0) {
      const worsening = typeof bottleneck.changePct === "number" && bottleneck.changePct > 15;
      drafts.push({
        type: "DELIVERY_BOTTLENECK",
        priority: worsening ? "HIGH" : "MEDIUM",
        title: `${bottleneck.stage} is slowing delivery`,
        reason: `${bottleneck.stage} takes ${formatDurationMs(bottleneck.averageMs)} on average${worsening ? `, up ${Math.round(bottleneck.changePct as number)}% from the previous period` : ""}.`,
        evidence: {
          stage: bottleneck.stage,
          averageMs: bottleneck.averageMs,
          count: bottleneck.count,
          changePct: bottleneck.changePct,
          cycleTimeMs: funnel.currentCycleTimeMs,
          cycleTimeChangePct: funnel.cycleTimeChangePct,
        },
        impact: `Delivery cycle time is ${formatDurationMs(funnel.currentCycleTimeMs)}; reducing this stage has the highest leverage.`,
        suggestedAction:
          bottleneck.stage === "Code review" || bottleneck.to === "prToReview" || bottleneck.to === "reviewToApproval"
            ? "Review reviewer assignment coverage and enforce review SLAs."
            : bottleneck.to === "mergeToDeploy"
              ? "Automate the deployment pipeline and reduce manual release steps."
              : "Investigate the pipeline stage and remove manual hand-offs.",
        dedupeKey: `bottleneck:${bottleneck.to}`,
      });
    }

    return drafts;
  }

  async notifyForNewHighPriority(workspaceId: string, saved: RecommendationDoc[]): Promise<void> {
    for (const rec of saved) {
      if (rec.priority !== "HIGH" && rec.priority !== "CRITICAL") continue;
      await notificationService.create({
        workspaceId,
        type: "RECOMMENDATION",
        severity: rec.priority === "CRITICAL" ? "CRITICAL" : "HIGH",
        title: rec.title,
        body: rec.reason,
        data: { recommendationId: rec._id.toString() },
        url: "/recommendations",
        dedupeKey: `rec:${rec.dedupeKey}`,
      });
    }
  }
}

export const recommendationService = new RecommendationService();
