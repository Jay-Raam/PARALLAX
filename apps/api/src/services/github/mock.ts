import type {
  DeploymentStatus,
  RiskLevel,
  SecurityCategory,
  Severity,
  UpdateType,
} from "@parallax/shared";
import type {
  GitHubBranchDTO,
  GitHubClient,
  GitHubCommitDTO,
  GitHubContributorDTO,
  GitHubDependencyDTO,
  GitHubDeploymentDTO,
  GitHubIssueDTO,
  GitHubPullRequestDTO,
  GitHubReleaseDTO,
  GitHubRepositoryDTO,
  GitHubReviewDTO,
  GitHubSecurityAlertDTO,
  GitHubWorkflowDTO,
  GitHubWorkflowRunDTO,
} from "./types.js";

/* ── deterministic PRNG ───────────────────────────────────── */

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ── mock repository catalog ──────────────────────────────── */

interface RepoProfile {
  name: string;
  fullName: string;
  description: string;
  language: string;
  techStack: string[];
  topics: string[];
  stars: number;
  private: boolean;
  commitsPerWeekday: number;
  contributors: string[];
  buildTimeMs: [number, number];
  failRate: number;
}

const PROFILES: RepoProfile[] = [
  {
    name: "NEBULA",
    fullName: "acme-infra/NEBULA",
    description: "Realtime orchestration platform for distributed services.",
    language: "TypeScript",
    techStack: ["Next.js", "Node.js", "MongoDB", "Redis", "Tailwind CSS", "GraphQL"],
    topics: ["orchestration", "realtime", "infrastructure"],
    stars: 1284,
    private: false,
    commitsPerWeekday: 3.4,
    contributors: ["jayraam", "sofia-ng", "dmitri-k", "amelia-chen", "raj-patel", "hanna-stein"],
    buildTimeMs: [210_000, 480_000],
    failRate: 0.06,
  },
  {
    name: "HEALTH-CARE-ERP",
    fullName: "acme-health/HEALTH-CARE-ERP",
    description: "ERP for healthcare providers: scheduling, billing, compliance.",
    language: "TypeScript",
    techStack: ["Next.js", "NestJS", "PostgreSQL", "MongoDB", "Prisma", "Docker"],
    topics: ["healthcare", "erp", "compliance"],
    stars: 342,
    private: true,
    commitsPerWeekday: 4.1,
    contributors: ["dmitri-k", "amelia-chen", "priya-sharma", "tom-okafor", "ines-dias"],
    buildTimeMs: [300_000, 720_000],
    failRate: 0.09,
  },
  {
    name: "WATCHMIND",
    fullName: "acme-analytics/WATCHMIND",
    description: "Real-time anomaly detection dashboards.",
    language: "Python",
    techStack: ["FastAPI", "Python", "Redis", "TimescaleDB", "Docker"],
    topics: ["analytics", "ml", "monitoring"],
    stars: 891,
    private: false,
    commitsPerWeekday: 2.7,
    contributors: ["sofia-ng", "leo-martins", "nora-ahmed", "hanna-stein", "marc-vidal"],
    buildTimeMs: [180_000, 420_000],
    failRate: 0.05,
  },
  {
    name: "TRAFFIC-FLOW",
    fullName: "acme-cities/TRAFFIC-FLOW",
    description: "Urban traffic simulation and routing intelligence.",
    language: "Go",
    techStack: ["Go", "gRPC", "Redis", "Kafka", "Docker"],
    topics: ["simulation", "routing", "smart-cities"],
    stars: 213,
    private: true,
    commitsPerWeekday: 3.0,
    contributors: ["raj-patel", "tom-okafor", "jayraam", "ines-dias", "leo-martins"],
    buildTimeMs: [150_000, 300_000],
    failRate: 0.04,
  },
  {
    name: "CINEPHILE",
    fullName: "acme-media/CINEPHILE",
    description: "Social catalog for films with watchlists and reviews.",
    language: "TypeScript",
    techStack: ["Next.js", "React", "MongoDB", "Tailwind CSS"],
    topics: ["media", "social", "catalog"],
    stars: 1507,
    private: false,
    commitsPerWeekday: 2.2,
    contributors: ["nora-ahmed", "marc-vidal", "priya-sharma", "sofia-ng"],
    buildTimeMs: [160_000, 340_000],
    failRate: 0.07,
  },
  {
    name: "PAYMENT-CORE",
    fullName: "acme-finance/PAYMENT-CORE",
    description: "Payments ledger, retries, and settlement engine.",
    language: "TypeScript",
    techStack: ["Node.js", "Express", "MongoDB", "Redis", "BullMQ"],
    topics: ["payments", "ledger", "finance"],
    stars: 76,
    private: true,
    commitsPerWeekday: 3.8,
    contributors: ["hanna-stein", "dmitri-k", "jayraam", "ines-dias", "tom-okafor"],
    buildTimeMs: [240_000, 600_000],
    failRate: 0.1,
  },
  {
    name: "ORBITAL-UI",
    fullName: "acme-design/ORBITAL-UI",
    description: "Design system and component library.",
    language: "TypeScript",
    techStack: ["React", "TypeScript", "Tailwind CSS", "Storybook"],
    topics: ["design-system", "ui", "components"],
    stars: 623,
    private: false,
    commitsPerWeekday: 1.9,
    contributors: ["marc-vidal", "nora-ahmed", "amelia-chen", "priya-sharma"],
    buildTimeMs: [120_000, 240_000],
    failRate: 0.03,
  },
  {
    name: "EDGE-CACHE",
    fullName: "acme-infra/EDGE-CACHE",
    description: "Global edge cache and CDN control plane.",
    language: "Rust",
    techStack: ["Rust", "Tokio", "Redis", "gRPC"],
    topics: ["cdn", "edge", "caching"],
    stars: 988,
    private: false,
    commitsPerWeekday: 2.5,
    contributors: ["leo-martins", "raj-patel", "sofia-ng", "hanna-stein"],
    buildTimeMs: [420_000, 900_000],
    failRate: 0.08,
  },
];

/* ── text templates ───────────────────────────────────────── */

const FEATURE_VERBS = ["Implement", "Add", "Introduce", "Extend", "Support", "Enable", "Expose"];
const FEATURE_NOUNS = [
  "payment retry system",
  "rate limiting middleware",
  "audit trail export",
  "scheduled report builder",
  "webhook delivery queue",
  "cache invalidation layer",
  "batch processing pipeline",
  "tenant isolation checks",
  "health check endpoint",
  "session persistence",
  "notification digest",
  "query result pagination",
];

const BUG_PREFIXES = ["fix", "Fix", "hotfix", "resolve"];
const BUG_NOUNS = [
  "race condition in sync worker",
  "null pointer in response mapper",
  "timeout on large payloads",
  "duplicate webhook delivery",
  "flaky test in e2e suite",
  "memory leak in connection pool",
  "incorrect cursor pagination",
  "stale cache after deploy",
  "auth redirect loop",
  "decimal rounding in ledger",
  "queue backpressure handling",
  "metric drift in dashboard",
];

const REFACTOR_NOUNS = [
  "extract sync service",
  "migrate resolvers to domain services",
  "deduplicate pagination logic",
  "split monolith worker",
  "introduce data loaders",
  "tighten GraphQL schema",
  "rework error boundaries",
  "modularize auth flows",
];

const DOC_NOUNS = [
  "document onboarding flow",
  "update API reference",
  "write architecture ADR",
  "expand test guide",
  "refresh README quickstart",
  "document retry semantics",
  "add runbook for incidents",
  "revise deployment guide",
];

const TEST_NOUNS = [
  "add unit tests for health engine",
  "cover PR risk scoring",
  "integration test sync pipeline",
  "e2e coverage for onboarding",
  "property tests for pagination",
  "snapshot the delivery funnel",
];

const CHORE_NOUNS = [
  "bump CI image versions",
  "pin dev dependencies",
  "rotate service account keys",
  "clean up dead code paths",
  "update license headers",
  "tune worker concurrency",
  "archive stale branches",
  "standardize log format",
];

const DEP_BUMPS = [
  "bump express from 4.19.2 to 4.21.2",
  "upgrade next from 14.2.4 to 15.5.0",
  "bump axios from 1.7.4 to 1.8.0",
  "upgrade react from 18.3.1 to 19.1.0",
  "bump zod from 3.22.4 to 3.25.0",
  "upgrade mongoose from 8.6.0 to 8.14.0",
  "bump redis client from 5.3.0 to 5.6.0",
  "upgrade vite from 5.4.0 to 6.3.0",
];

const FILE_PATHS = {
  auth: ["src/auth/middleware.ts", "src/auth/session.ts", "src/auth/oauth.ts", "src/auth/rbac.ts"],
  payment: ["src/payments/ledger.ts", "src/payments/retry.ts", "src/payments/settlement.ts", "src/payments/webhook.ts"],
  service: ["src/services/sync.ts", "src/services/health.ts", "src/services/analytics.ts", "src/services/search.ts"],
  migration: ["migrations/001_initial.ts", "migrations/002_workspaces.ts", "db/migrations/003_indexes.ts"],
  test: ["src/auth/__tests__/middleware.test.ts", "src/payments/__tests__/retry.test.ts", "src/services/__tests__/health.test.ts"],
  config: ["package.json", "tsconfig.json", "docker-compose.yml", ".github/workflows/ci.yml"],
  core: ["src/index.ts", "src/app.ts", "src/config/env.ts", "src/lib/errors.ts"],
} as const;

/* ── version data for dependencies ────────────────────────── */

interface DepProfile {
  name: string;
  ecosystem: string;
  current: string;
  latest: string;
  updateType: UpdateType;
  risk: RiskLevel;
  vulnerability?: Severity;
}

const DEP_PROFILES: DepProfile[] = [
  { name: "next", ecosystem: "npm", current: "14.2.4", latest: "15.5.0", updateType: "MAJOR", risk: "HIGH" },
  { name: "react", ecosystem: "npm", current: "19.0.0", latest: "19.1.0", updateType: "MINOR", risk: "LOW" },
  { name: "react-dom", ecosystem: "npm", current: "19.0.0", latest: "19.1.0", updateType: "MINOR", risk: "LOW" },
  { name: "axios", ecosystem: "npm", current: "1.7.4", latest: "1.8.0", updateType: "MINOR", risk: "LOW" },
  { name: "express", ecosystem: "npm", current: "4.21.1", latest: "5.1.0", updateType: "MAJOR", risk: "HIGH", vulnerability: "MEDIUM" },
  { name: "mongoose", ecosystem: "npm", current: "8.6.0", latest: "8.14.0", updateType: "MINOR", risk: "LOW" },
  { name: "ioredis", ecosystem: "npm", current: "5.3.2", latest: "5.6.0", updateType: "MINOR", risk: "LOW" },
  { name: "zod", ecosystem: "npm", current: "3.22.4", latest: "3.25.0", updateType: "MINOR", risk: "LOW" },
  { name: "lodash", ecosystem: "npm", current: "4.17.21", latest: "4.17.21", updateType: "NONE", risk: "LOW", vulnerability: "HIGH" },
  { name: "graphql", ecosystem: "npm", current: "16.8.1", latest: "16.11.0", updateType: "MINOR", risk: "LOW" },
  { name: "fastify", ecosystem: "npm", current: "4.26.2", latest: "5.3.0", updateType: "MAJOR", risk: "MEDIUM" },
  { name: "typescript", ecosystem: "npm", current: "5.4.5", latest: "5.8.2", updateType: "MINOR", risk: "LOW" },
  { name: "undici", ecosystem: "npm", current: "6.12.0", latest: "6.21.0", updateType: "MINOR", risk: "MEDIUM", vulnerability: "CRITICAL" },
  { name: "webpack", ecosystem: "npm", current: "5.91.0", latest: "5.98.0", updateType: "MINOR", risk: "LOW" },
  { name: "eslint", ecosystem: "npm", current: "9.1.1", latest: "9.21.0", updateType: "MINOR", risk: "LOW" },
  { name: "jest", ecosystem: "npm", current: "29.7.0", latest: "29.7.0", updateType: "NONE", risk: "LOW" },
  { name: "vitest", ecosystem: "npm", current: "1.6.0", latest: "3.0.9", updateType: "MAJOR", risk: "MEDIUM" },
  { name: "msw", ecosystem: "npm", current: "2.3.1", latest: "2.7.3", updateType: "MINOR", risk: "LOW" },
  { name: "playwright", ecosystem: "npm", current: "1.44.1", latest: "1.51.1", updateType: "MINOR", risk: "LOW" },
  { name: "tailwindcss", ecosystem: "npm", current: "3.4.3", latest: "4.1.0", updateType: "MAJOR", risk: "MEDIUM" },
  { name: "react-query", ecosystem: "npm", current: "5.36.0", latest: "5.66.9", updateType: "MINOR", risk: "LOW" },
  { name: "bullmq", ecosystem: "npm", current: "5.12.0", latest: "5.44.1", updateType: "MINOR", risk: "LOW" },
  { name: "pino", ecosystem: "npm", current: "9.2.0", latest: "9.6.0", updateType: "MINOR", risk: "LOW" },
  { name: "docker-compose", ecosystem: "npm", current: "2.24.0", latest: "2.29.0", updateType: "MINOR", risk: "LOW" },
];

/* ── helper pickers ───────────────────────────────────────── */

function pick<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}

function pickN<T>(rand: () => number, arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length) {
    out.push(copy.splice(Math.floor(rand() * copy.length), 1)[0]!);
  }
  return out;
}

function classifyMessage(message: string): GitHubCommitDTO["classification"] {
  const lower = message.toLowerCase();
  if (lower.startsWith("fix") || lower.startsWith("hotfix") || lower.includes("resolve")) return "bugfix";
  if (lower.startsWith("feat") || lower.includes("implement") || lower.startsWith("add ")) return "feature";
  if (lower.includes("refactor") || lower.includes("extract") || lower.includes("migrate") || lower.includes("deduplicat")) return "refactor";
  if (lower.includes("doc") || lower.includes("readme") || lower.includes("adr")) return "docs";
  if (lower.includes("test")) return "tests";
  if (lower.includes("bump") || lower.includes("upgrade") || lower.includes("pin")) return "dependency";
  return "chore";
}

function isStaleVersion(current: string, latest: string): boolean {
  return current !== latest;
}

/* ── the mock client ──────────────────────────────────────── */

export class MockGitHubClient implements GitHubClient {
  readonly mode = "mock" as const;

  private rand(repo: RepoProfile): () => number {
    return mulberry32(hashString(repo.fullName));
  }

  async listRepositories(): Promise<GitHubRepositoryDTO[]> {
    return PROFILES.map((profile) => this.toRepositoryDTO(profile));
  }

  async getRepository(fullName: string): Promise<GitHubRepositoryDTO | null> {
    const profile = PROFILES.find((p) => p.fullName === fullName);
    return profile ? this.toRepositoryDTO(profile) : null;
  }

  private toRepositoryDTO(profile: RepoProfile): GitHubRepositoryDTO {
    return {
      githubId: hashString(profile.fullName) % 1_000_000_000,
      name: profile.name,
      fullName: profile.fullName,
      owner: profile.fullName.split("/")[0]!,
      description: profile.description,
      url: `https://github.com/${profile.fullName}`,
      defaultBranch: "main",
      isPrivate: profile.private,
      language: profile.language,
      techStack: profile.techStack,
      topics: profile.topics,
      fork: false,
      archived: false,
      createdAt: new Date(Date.now() - 420 * 86_400_000).toISOString(),
      pushedAt: new Date(Date.now() - Math.floor(Math.random() * 3 * 3_600_000)).toISOString(),
      starCount: profile.stars,
      forkCount: Math.floor(profile.stars * 0.22),
      openIssuesCount: 0,
    };
  }

  async listBranches(repo: GitHubRepositoryDTO): Promise<GitHubBranchDTO[]> {
    const rand = this.rand(this.profileFor(repo));
    const branches = [
      { name: "main", headSha: "abc".padEnd(40, "0"), isDefault: true },
      { name: "develop", headSha: "def".padEnd(40, "0"), isDefault: false },
      { name: "release/stable", headSha: "111".padEnd(40, "0"), isDefault: false },
    ];
    const extra = Math.floor(rand() * 3);
    for (let i = 0; i < extra; i++) {
      branches.push({
        name: `feature/${pick(rand, ["payments", "sync", "search", "auth", "dashboard"])}-${100 + i}`,
        headSha: `${(1000 + i).toString(16)}`.padEnd(40, "f"),
        isDefault: false,
      });
    }
    return branches.map((b) => ({ ...b, lastCommitAt: new Date(Date.now() - Math.floor(rand() * 72 * 3_600_000)).toISOString() }));
  }

  async listCommits(repo: GitHubRepositoryDTO, since?: string): Promise<GitHubCommitDTO[]> {
    const profile = this.profileFor(repo);
    const rand = this.rand(profile);
    const sinceDate = since ? new Date(since) : new Date(Date.now() - 260 * 86_400_000);
    const commits: GitHubCommitDTO[] = [];
    const cursor = new Date(sinceDate.getTime());

    while (cursor.getTime() < Date.now() - 30 * 60_000) {
      const dayOfWeek = cursor.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      let count = Math.round(profile.commitsPerWeekday * (isWeekend ? 0.3 : 1));
      if (rand() < 0.15) count += Math.floor(rand() * 3);
      for (let i = 0; i < count; i++) {
        const author = pick(rand, profile.contributors);
        const hour = Math.floor(rand() * 10) + 8;
        const date = new Date(cursor);
        date.setHours(hour, Math.floor(rand() * 60), Math.floor(rand() * 60), 0);

        const roll = rand();
        let message: string;
        let additions: number;
        let deletions: number;
        let filesChanged: number;

        if (roll < 0.38) {
          message = `${pick(rand, FEATURE_VERBS)} ${pick(rand, FEATURE_NOUNS)}`;
          additions = 80 + Math.floor(rand() * 600);
          deletions = Math.floor(rand() * 120);
          filesChanged = 2 + Math.floor(rand() * 10);
        } else if (roll < 0.66) {
          message = `${pick(rand, BUG_PREFIXES)} ${pick(rand, BUG_NOUNS)}`;
          additions = 10 + Math.floor(rand() * 140);
          deletions = 10 + Math.floor(rand() * 120);
          filesChanged = 1 + Math.floor(rand() * 6);
        } else if (roll < 0.76) {
          message = `refactor: ${pick(rand, REFACTOR_NOUNS)}`;
          additions = 40 + Math.floor(rand() * 300);
          deletions = 30 + Math.floor(rand() * 260);
          filesChanged = 2 + Math.floor(rand() * 14);
        } else if (roll < 0.84) {
          message = `docs: ${pick(rand, DOC_NOUNS)}`;
          additions = 20 + Math.floor(rand() * 200);
          deletions = Math.floor(rand() * 60);
          filesChanged = 1 + Math.floor(rand() * 4);
        } else if (roll < 0.92) {
          message = `test: ${pick(rand, TEST_NOUNS)}`;
          additions = 60 + Math.floor(rand() * 220);
          deletions = Math.floor(rand() * 40);
          filesChanged = 1 + Math.floor(rand() * 3);
        } else if (roll < 0.97) {
          message = `chore: ${pick(rand, CHORE_NOUNS)}`;
          additions = 10 + Math.floor(rand() * 90);
          deletions = 10 + Math.floor(rand() * 80);
          filesChanged = 1 + Math.floor(rand() * 5);
        } else {
          message = pick(rand, DEP_BUMPS);
          additions = 2 + Math.floor(rand() * 40);
          deletions = 2 + Math.floor(rand() * 40);
          filesChanged = 1 + Math.floor(rand() * 3);
        }

        const sha = `${hashString(message + date.toISOString()).toString(16).padStart(40, "0")}`;
        commits.push({
          sha,
          authorLogin: author,
          authorName: author.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          authorEmail: `${author}@acme.dev`,
          message,
          date: date.toISOString(),
          additions,
          deletions,
          filesChanged,
          isMerge: rand() < 0.04,
          classification: classifyMessage(message),
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    // Keep at most ~1800 commits per full sync for determinism and speed
    if (!since && commits.length > 1800) {
      return commits.slice(commits.length - 1800);
    }
    return commits;
  }

  async listPullRequests(repo: GitHubRepositoryDTO): Promise<GitHubPullRequestDTO[]> {
    const profile = this.profileFor(repo);
    const rand = this.rand(profile);
    const prs: GitHubPullRequestDTO[] = [];
    const count = 45 + Math.floor(rand() * 20);
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const createdDaysAgo = 1 + Math.floor(rand() * 179);
      const createdAt = new Date(now - createdDaysAgo * 86_400_000);
      const isOpen = rand() < 0.28;
      const merged = !isOpen && rand() < 0.82;
      const titleRoll = rand();

      let title: string;
      if (titleRoll < 0.4) title = `${pick(rand, FEATURE_VERBS)} ${pick(rand, FEATURE_NOUNS)}`;
      else if (titleRoll < 0.7) title = `fix: ${pick(rand, BUG_NOUNS)}`;
      else if (titleRoll < 0.82) title = `refactor: ${pick(rand, REFACTOR_NOUNS)}`;
      else if (titleRoll < 0.9) title = `chore: ${pick(rand, CHORE_NOUNS)}`;
      else title = `test: ${pick(rand, TEST_NOUNS)}`;

      const files: string[] = pickN(rand, [...FILE_PATHS.auth, ...FILE_PATHS.payment, ...FILE_PATHS.service, ...FILE_PATHS.core, ...FILE_PATHS.test], 3 + Math.floor(rand() * 9));
      const additions = 40 + Math.floor(rand() * 900);
      const deletions = 20 + Math.floor(rand() * 420);
      const author = pick(rand, profile.contributors);

      // lifecycle
      const firstReviewHours = 3 + rand() * 30;
      const approvalHours = firstReviewHours + rand() * 18;
      const mergeHours = approvalHours + rand() * 12;
      const firstReviewAt = new Date(createdAt.getTime() + firstReviewHours * 3_600_000);
      const mergedAt = merged ? new Date(createdAt.getTime() + mergeHours * 3_600_000) : undefined;

      const reviewers = pickN(rand, profile.contributors.filter((c) => c !== author), 1 + Math.floor(rand() * 2));
      const reviews: GitHubReviewDTO[] = [];
      if (!isOpen || rand() < 0.6) {
        for (const reviewer of reviewers) {
          const stateRoll = rand();
          const reviewState = stateRoll < 0.62 ? "APPROVED" : stateRoll < 0.85 ? "CHANGES_REQUESTED" : "COMMENTED";
          reviews.push({
            reviewerLogin: reviewer,
            state: reviewState,
            submittedAt: firstReviewAt.toISOString(),
            body: reviewState === "CHANGES_REQUESTED" ? "Please address the inline comments before merge." : "LGTM.",
          });
        }
      }

      const hasAuthChange = files.some((f) => f.includes("auth"));
      const hasPaymentChange = files.some((f) => f.includes("payment"));
      const hasMigration = files.some((f) => f.includes("migration"));
      const hasTestChange = files.some((f) => f.includes("__tests__") || f.includes(".test."));
      const hasDepChange = files.includes("package.json");

      const deployAt = merged && rand() < 0.9 ? new Date(mergedAt!.getTime() + (10 + rand() * 120) * 60_000) : undefined;

      prs.push({
        githubNumber: 100 + i,
        title,
        body: `## Summary\n\nImplements the requested change. Fixes #${90 + Math.floor(rand() * 60)}.`,
        state: isOpen ? "OPEN" : merged ? "MERGED" : "CLOSED",
        authorLogin: author,
        createdAt: createdAt.toISOString(),
        updatedAt: (deployAt ?? mergedAt ?? new Date(now - Math.floor(rand() * 48 * 3_600_000))).toISOString(),
        closedAt: mergedAt?.toISOString(),
        mergedAt: mergedAt?.toISOString(),
        mergedBy: reviewers[0],
        baseRef: "main",
        headRef: `feature/${pick(rand, ["payments", "sync", "search", "auth"])}-${100 + i}`,
        additions,
        deletions,
        changedFiles: files.length,
        commits: 1 + Math.floor(rand() * 9),
        isDraft: isOpen && rand() < 0.12,
        labels: [...pickN(rand, ["feature", "bug", "refactor", "dependencies", "tech-debt"], Math.floor(rand() * 3))],
        reviewDecision: reviews.some((r) => r.state === "APPROVED") ? "APPROVED" : reviews.some((r) => r.state === "CHANGES_REQUESTED") ? "CHANGES_REQUESTED" : "REVIEW_REQUIRED",
        files,
        reviews,
        deployAt: deployAt?.toISOString(),
      });

      void hasAuthChange;
      void hasPaymentChange;
      void hasMigration;
      void hasTestChange;
      void hasDepChange;
    }
    return prs;
  }

  async listIssues(repo: GitHubRepositoryDTO): Promise<GitHubIssueDTO[]> {
    const profile = this.profileFor(repo);
    const rand = this.rand(profile);
    const issues: GitHubIssueDTO[] = [];
    const count = 85 + Math.floor(rand() * 30);
    const now = Date.now();

    const TITLES = [
      "Payment timeout on large invoices",
      "Dashboard charts lag on workspace switch",
      "Rate limiter rejects legitimate batch sync",
      "Webhook replay causes duplicate notifications",
      "Pagination cursor breaks after filter change",
      "Health score flips between sync runs",
      "OAuth state parameter mismatch",
      "Search debounce drops keystrokes",
      "Dependency radar shows stale versions",
      "Worker stalls on large repository sync",
      "Session cookie expires during onboarding",
      "Delivery funnel times are inconsistent",
      "Security alert severities not normalized",
      "CI artifact retention fills disk",
      "Contributor avatars fail to load",
      "Recommendation evidence JSON not escaped",
      "Command palette focus trap on escape",
      "Issue staleness threshold off by one day",
      "GraphQL depth limit blocks legit query",
      "Deployment timeline missing failed runs",
    ];

    for (let i = 0; i < count; i++) {
      const createdDaysAgo = 1 + Math.floor(rand() * 200);
      const createdAt = new Date(now - createdDaysAgo * 86_400_000);
      const isOpen = rand() < 0.46;
      const closedAt = isOpen ? undefined : new Date(createdAt.getTime() + (rand() * 20 + 1) * 86_400_000);
      const updatedAt: Date = isOpen
        ? new Date(createdAt.getTime() + rand() * Math.max(1, now - createdAt.getTime()))
        : (closedAt ?? createdAt);
      const labels = pickN(rand, ["bug", "enhancement", "critical", "security", "tech-debt", "good-first-issue"], Math.floor(rand() * 3));

      issues.push({
        githubNumber: 200 + i,
        title: pick(rand, TITLES),
        body: "## Expected behavior\n\n## Actual behavior\n\n## Steps to reproduce",
        state: isOpen ? "OPEN" : "CLOSED",
        authorLogin: pick(rand, profile.contributors),
        createdAt: createdAt.toISOString(),
        updatedAt: updatedAt.toISOString(),
        closedAt: closedAt?.toISOString(),
        labels,
        assignees: isOpen && rand() < 0.6 ? [pick(rand, profile.contributors)] : [],
        commentsCount: Math.floor(rand() * 9),
      });
    }
    return issues;
  }

  async listDependencies(repo: GitHubRepositoryDTO): Promise<GitHubDependencyDTO[]> {
    const rand = this.rand(this.profileFor(repo));
    const count = 14 + Math.floor(rand() * 7);
    const deps: GitHubDependencyDTO[] = [];
    const pool = [...DEP_PROFILES];
    for (let i = 0; i < count && pool.length; i++) {
      const idx = Math.floor(rand() * pool.length);
      const dep = pool.splice(idx, 1)[0]!;
      const outdated = isStaleVersion(dep.current, dep.latest);
      deps.push({
        name: dep.name,
        ecosystem: dep.ecosystem,
        currentVersion: dep.current,
        latestVersion: dep.latest,
        updateType: dep.updateType,
        risk: dep.risk,
        vulnerabilities: dep.vulnerability
          ? [{ severity: dep.vulnerability, advisory: `CVE advisory for ${dep.name}` }]
          : [],
        isDirect: rand() < 0.8,
        outdated,
        packageManager: "package.json",
      });
    }
    return deps;
  }

  async listSecurityAlerts(repo: GitHubRepositoryDTO): Promise<GitHubSecurityAlertDTO[]> {
    const rand = this.rand(this.profileFor(repo));
    const alerts: GitHubSecurityAlertDTO[] = [];
    const now = Date.now();
    const severities: Severity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];
    const categories: SecurityCategory[] = [
      "DEPENDABOT",
      "SECRET_SCANNING",
      "CODE_SCANNING",
      "WORKFLOW_SECURITY",
      "DEPENDENCY_VULNERABILITIES",
      "REPOSITORY_PERMISSIONS",
      "BRANCH_PROTECTION",
    ];

    const count = 5 + Math.floor(rand() * 5);
    for (let i = 0; i < count; i++) {
      const category = categories[i % categories.length]!;
      const severity = severities[Math.floor(rand() * (category === "SECRET_SCANNING" ? 3 : 4))]!;
      const isOpen = rand() < 0.55;
      alerts.push({
        githubId: hashString(`${repo.fullName}-alert-${i}`) % 10_000_000,
        type: category,
        severity,
        title:
          category === "DEPENDABOT" || category === "DEPENDENCY_VULNERABILITIES"
            ? `Dependency vulnerability in ${pick(rand, ["axios", "undici", "lodash", "express"])}`
            : category === "SECRET_SCANNING"
              ? "Possible credential exposed in commit history"
              : category === "WORKFLOW_SECURITY"
                ? "CI workflow pins untrusted third-party action"
                : category === "REPOSITORY_PERMISSIONS"
                  ? "Write access granted to outside collaborator"
                  : "Default branch lacks required status checks",
        description: "Details available in the GitHub security center.",
        state: isOpen ? "OPEN" : "FIXED",
        createdAt: new Date(now - Math.floor(rand() * 120) * 86_400_000).toISOString(),
        url: `https://github.com/${repo.fullName}/security`,
        packageName: category.includes("DEPENDENCY") || category === "DEPENDABOT" ? pick(rand, ["axios", "undici", "lodash", "express"]) : undefined,
      });
    }
    return alerts;
  }

  async listWorkflows(_repo: GitHubRepositoryDTO): Promise<GitHubWorkflowDTO[]> {
    return [
      { name: "CI", path: ".github/workflows/ci.yml", state: "ACTIVE" },
      { name: "Deploy", path: ".github/workflows/deploy.yml", state: "ACTIVE" },
      { name: "Dependency Review", path: ".github/workflows/dependency-review.yml", state: "ACTIVE" },
    ];
  }

  async listWorkflowRuns(repo: GitHubRepositoryDTO): Promise<GitHubWorkflowRunDTO[]> {
    const profile = this.profileFor(repo);
    const rand = this.rand(profile);
    const runs: GitHubWorkflowRunDTO[] = [];
    const count = 40 + Math.floor(rand() * 20);
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const createdAt = new Date(now - (1 + Math.floor(rand() * 179)) * 86_400_000);
      const failed = rand() < profile.failRate;
      const inProgress = rand() < 0.04;
      const durationMs = Math.floor(profile.buildTimeMs[0] + rand() * (profile.buildTimeMs[1] - profile.buildTimeMs[0]));
      const steps = [
        { name: "checkout", status: "completed", conclusion: "success", durationMs: 18_000 + Math.floor(rand() * 20_000) },
        { name: "setup", status: "completed", conclusion: "success", durationMs: 12_000 + Math.floor(rand() * 15_000) },
        { name: "install", status: "completed", conclusion: "success", durationMs: 60_000 + Math.floor(rand() * 90_000) },
        { name: "lint", status: failed && rand() < 0.3 ? "completed" : "completed", conclusion: failed && rand() < 0.3 ? "failure" : "success", durationMs: 25_000 + Math.floor(rand() * 40_000) },
        { name: "test", status: "completed", conclusion: failed ? "failure" : "success", durationMs: 120_000 + Math.floor(rand() * 180_000) },
        { name: "build", status: "completed", conclusion: failed && rand() < 0.2 ? "failure" : "success", durationMs: 90_000 + Math.floor(rand() * 160_000) },
      ];

      runs.push({
        workflowName: i % 6 === 0 ? "Deploy" : "CI",
        workflowPath: i % 6 === 0 ? ".github/workflows/deploy.yml" : ".github/workflows/ci.yml",
        runNumber: 1000 + i,
        event: pick(rand, ["push", "pull_request", "schedule", "workflow_dispatch"] as const),
        status: inProgress ? "IN_PROGRESS" : failed ? "COMPLETED" : "COMPLETED",
        headSha: `${hashString(`run-${i}`).toString(16).padStart(40, "0")}`,
        branch: rand() < 0.8 ? "main" : "develop",
        createdAt: createdAt.toISOString(),
        durationMs: inProgress ? undefined : durationMs,
        steps: steps.map((s) => ({ ...s, conclusion: inProgress ? undefined : s.conclusion })),
      });
    }
    return runs;
  }

  async listDeployments(repo: GitHubRepositoryDTO): Promise<GitHubDeploymentDTO[]> {
    const rand = this.rand(this.profileFor(repo));
    const deployments: GitHubDeploymentDTO[] = [];
    const count = 14 + Math.floor(rand() * 8);
    const now = Date.now();
    let minor = 0;
    let patch = 0;
    const major = 2;

    for (let i = 0; i < count; i++) {
      patch += 1 + Math.floor(rand() * 3);
      if (patch > 9) {
        patch = 0;
        minor += 1;
      }
      const createdAt = new Date(now - (0.2 + i * (1.5 + rand() * 4)) * 86_400_000);
      const failed = rand() < 0.08;
      const status: DeploymentStatus = failed ? "FAILURE" : "SUCCESS";
      const version = i % 3 === 0 ? `v${major}.${minor}.${patch}` : undefined;

      deployments.push({
        environment: "Production",
        ref: "main",
        sha: `${hashString(`deploy-${i}`).toString(16).padStart(40, "0")}`,
        creatorLogin: pick(rand, this.profileFor(repo).contributors),
        status,
        description: failed ? "Health checks failed after rollout" : "Deployed successfully",
        createdAt: createdAt.toISOString(),
        version,
      });
    }
    return deployments;
  }

  async listReleases(repo: GitHubRepositoryDTO): Promise<GitHubReleaseDTO[]> {
    const profile = this.profileFor(repo);
    const rand = this.rand(profile);
    const releases: GitHubReleaseDTO[] = [];
    const count = 8 + Math.floor(rand() * 8);
    const now = Date.now();

    for (let i = 0; i < count; i++) {
      const publishedAt = new Date(now - (2 + i * (4 + rand() * 5)) * 86_400_000);
      const major = 2 + Math.floor(rand() * 2);
      const minor = Math.floor(rand() * 9);
      const patch = Math.floor(rand() * 9);
      const features = pickN(rand, FEATURE_NOUNS, 2 + Math.floor(rand() * 3));
      const bugFixes = pickN(rand, BUG_NOUNS, 1 + Math.floor(rand() * 3));
      const breaking = rand() < 0.25 ? pickN(rand, ["API response schema changed", "Configuration format migrated", "Removed deprecated endpoints"], 1) : [];
      const depChanges = rand() < 0.5 ? pickN(rand, DEP_BUMPS, 1 + Math.floor(rand() * 2)) : [];

      releases.push({
        tagName: `v${major}.${minor}.${patch}`,
        name: `Release v${major}.${minor}.${patch}`,
        publishedAt: publishedAt.toISOString(),
        authorLogin: pick(rand, profile.contributors),
        isPrerelease: rand() < 0.12,
        body: `## What's Changed\n\n${features.map((f) => `* ${f}`).join("\n")}`,
        commitSha: `${hashString(`rel-${i}`).toString(16).padStart(40, "0")}`,
        commitCount: 5 + Math.floor(rand() * 60),
        features,
        bugFixes,
        breakingChanges: breaking,
        dependencyChanges: depChanges,
      });
    }
    return releases;
  }

  async listContributors(repo: GitHubRepositoryDTO): Promise<GitHubContributorDTO[]> {
    const profile = this.profileFor(repo);
    const commits = await this.listCommits(repo);
    const prs = await this.listPullRequests(repo);
    const issues = await this.listIssues(repo);

    const byLogin = new Map<string, GitHubContributorDTO>();
    for (const login of profile.contributors) {
      byLogin.set(login, {
        login,
        name: login.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        avatarUrl: `https://avatars.githubusercontent.com/${login}`,
        role: login === "jayraam" ? "ADMIN" : "MEMBER",
        commits: 0,
        additions: 0,
        deletions: 0,
        pullRequestsCreated: 0,
        reviewsGiven: 0,
        issuesOpened: 0,
        issuesClosed: 0,
        firstContributionAt: new Date().toISOString(),
        lastContributionAt: new Date(0).toISOString(),
      });
    }
    for (const commit of commits) {
      const c = byLogin.get(commit.authorLogin);
      if (!c) continue;
      c.commits += 1;
      c.additions += commit.additions;
      c.deletions += commit.deletions;
      if (new Date(commit.date) < new Date(c.firstContributionAt)) c.firstContributionAt = commit.date;
      if (new Date(commit.date) > new Date(c.lastContributionAt)) c.lastContributionAt = commit.date;
    }
    for (const pr of prs) {
      const author = byLogin.get(pr.authorLogin);
      if (author) author.pullRequestsCreated += 1;
      for (const review of pr.reviews) {
        const reviewer = byLogin.get(review.reviewerLogin);
        if (reviewer) reviewer.reviewsGiven += 1;
      }
    }
    for (const issue of issues) {
      const author = byLogin.get(issue.authorLogin);
      if (author) {
        author.issuesOpened += 1;
        if (issue.state === "CLOSED") author.issuesClosed += 1;
      }
    }
    return [...byLogin.values()];
  }

  private profileFor(repo: GitHubRepositoryDTO): RepoProfile {
    return PROFILES.find((p) => p.fullName === repo.fullName) ?? PROFILES[0]!;
  }
}
