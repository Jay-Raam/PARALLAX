# PARALLAX — Engineering Intelligence Platform ⚡

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Next.js 15](https://img.shields.io/badge/Frontend-Next.js%2015%20App%20Router-black.svg)](apps/web)
[![GraphQL Yoga](https://img.shields.io/badge/API-GraphQL%20Yoga-E10098.svg)](apps/api)
[![BullMQ](https://img.shields.io/badge/Background%20Workers-BullMQ%20%2B%20Redis-red.svg)](apps/api)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB%20Mongoose-green.svg)](docker-compose.yml)

> **GitHub records what happened. PARALLAX explains what it means.**

PARALLAX connects to GitHub, collects repository activity, and turns it into
measurable engineering health, risk, bottlenecks, trends, and actionable
recommendations.

---

## Start Here (5-Minute Code Review)

If you are inspecting PARALLAX for software craftsmanship, architectural clarity, and queue reliability:

| Component | Location | What to Inspect |
| :--- | :--- | :--- |
| **Health Scoring Engine** | [`apps/api/src/modules/health/healthService.ts`](apps/api/src/modules/health/healthService.ts) | Multi-factor weighted engineering posture evaluation (testing, security, release cadence, hygiene) |
| **PR Risk Engine** | [`apps/api/src/modules/pulls/riskService.ts`](apps/api/src/modules/pulls/riskService.ts) | Deterministic risk scoring evaluating diff size, migration hazards, and missing tests |
| **BullMQ Queue Orchestrator** | [`apps/api/src/queues/syncQueue.ts`](apps/api/src/queues/syncQueue.ts) | Asynchronous job processing with exponential backoff, worker concurrency, and inline fallback |
| **GraphQL Subscription Hub** | [`apps/api/src/graphql/yoga.ts`](apps/api/src/graphql/yoga.ts) | Real-time WebSocket telemetry broadcasting sync status and metric adjustments |
| **Command Palette Hub** | [`apps/web/src/components/CommandPalette.tsx`](apps/web/src/components/CommandPalette.tsx) | Instant cross-entity fuzzy search across repos, pull requests, and audit findings |

---

## Architecture

```
apps/
  web/      Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · TanStack Query
  api/      Express · GraphQL Yoga · Mongoose · BullMQ · Pino
packages/
  shared/   Enums, constants, Zod validators
  types/    Shared TypeScript domain types
  graphql/  The GraphQL schema (single source of truth)
  config/   Shared config defaults
```

The backend is a **modular monolith** with two processes:

| Process | Responsibility |
| --- | --- |
| `parallax-api` | HTTP · GraphQL · OAuth · webhooks · auth · RBAC · caching |
| `parallax-worker` | GitHub sync · analytics · health · PR risk · recommendations · notifications |

Data flow: GitHub API → mapper → MongoDB (source of truth), with Redis for
caching, queues (BullMQ), rate limiting, pub/sub, and webhook deduplication.

## Quick start

### Option A — Docker Compose (MongoDB + Redis + API + worker + web)

```bash
docker compose up --build
# web   → http://localhost:3000
# api   → http://localhost:4000/graphql
# mongo → localhost:27017 · redis → localhost:6379
```

Seed the demo workspace (8 repositories, ~5,000 commits, 440 PRs, 800 issues,
100+ dependencies, recommendations):

```bash
docker compose exec api node apps/api/dist/seed/index.js
```

> The seed runs the **real** sync pipeline (mapper → MongoDB → analytics →
> health → recommendations) against the built-in mock GitHub client, so the
> whole platform works without GitHub credentials.

### Option B — Local development (npm workspaces)

Requires Node 20+ and a MongoDB + Redis (local, or your own URLs):

```bash
cp .env.example .env      # set MONGODB_URI and REDIS_URL
npm install
npm run seed              # optional: demo workspace
npm run dev               # web (:3000) + api (:4000) + worker concurrently
```

Or run processes individually: `npm run dev:web`, `npm run dev:api`,
`npm run dev:worker`.

**Demo login:** use the seeded account `email@example.com` (button on the login
page), or sign in with any email to get a fresh workspace.

## Features

- **Engineering Health** — weighted score (code quality, testing, dependencies,
  security, docs, CI/CD, activity, issue hygiene, release stability) with trend,
  explanations, and risk factors.
- **PR Risk Engine** — deterministic risk scoring: large diffs, auth/security
  paths, migrations, dependency changes, missing tests, critical modules.
- **Dependency Radar** — outdated + vulnerable packages, filtered by update type
  and risk.
- **Security Center** — Dependabot, secret scanning, workflow security,
  aggregated posture score.
- **Delivery Funnel** — Commit → PR → review → approval → merge → CI → deploy →
  release with per-stage timing and the detected bottleneck.
- **Recommendations** — every finding includes priority, reason, evidence,
  impact, and a suggested action.
- **Real-time updates** — GraphQL subscriptions for sync progress, health
  updates, workflow/deployment changes, and notifications.
- **Workspaces & RBAC** — OWNER / ADMIN / MEMBER / VIEWER, tenant isolation,
  audit logs.
- **Command palette (`⌘K`)** — global search across repositories, PRs, issues,
  commits, dependencies, contributors, and recommendations, plus commands.
- **OAuth + webhooks** — GitHub OAuth 2.0, HMAC-verified webhooks with
  deduplication, incremental syncs.

## Environment variables

See [`.env.example`](.env.example). Backend: `MONGODB_URI`, `REDIS_URL`,
`GITHUB_CLIENT_ID/SECRET`, `GITHUB_WEBHOOK_SECRET`, `SESSION_SECRET`,
`ENCRYPTION_KEY`, `CORS_ORIGIN`. Frontend: `NEXT_PUBLIC_API_URL`,
`NEXT_PUBLIC_GRAPHQL_URL`.

Without `GITHUB_CLIENT_ID/SECRET` the OAuth route returns a friendly error and
the app runs in **mock mode** (built-in mock GitHub client), so every feature
works locally.

## Testing

```bash
npm run test            # backend + frontend unit tests
npm run test -w @parallax/api    # backend only (in-memory MongoDB)
npm run test -w @parallax/web    # frontend component tests
npm run typecheck       # strict TS across all workspaces
npm run lint
```

Backend tests cover the health engine, PR risk engine, and the full sync →
health pipeline against an in-memory MongoDB. E2E (Playwright) scaffolding
lives in `e2e/` — see `npm run test:e2e`.

## Key Engineering Decisions & Trade-Offs

| Decision | Why It Was Made | Alternative Considered & Why Rejected |
| :--- | :--- | :--- |
| **BullMQ Worker Process with Inline Fallback** | GitHub repository sync, webhook payload parsing, and health metric recalculations are asynchronous and CPU/IO heavy. Offloading to Redis BullMQ prevents Express event-loop starvation. | Handling sync computations synchronously within GraphQL resolvers. Rejected because processing large PR histories causes 504 gateway timeouts on client requests. |
| **MongoDB as Source of Truth + Redis as Ephemeral Cache** | MongoDB provides schema flexibility for heterogeneous GitHub webhook payloads (commits, reviews, checks, deployment runs) without rigid SQL migrations. Redis stores TTL-cached query responses, rate-limiting tokens, and deduplication keys. | Storing everything in PostgreSQL. Rejected because nested JSON structures in GitHub issue events require constant schema alterations that degrade relational query velocity. |
| **Encrypted At-Rest GitHub OAuth Tokens & HttpOnly Sessions** | Third-party GitHub OAuth tokens are encrypted at rest with AES-256 before storage in MongoDB. Browser sessions use signed, HttpOnly cookies with strict CSRF protection. | Passing raw GitHub tokens to the Next.js client or storing in local storage. Rejected because it exposes third-party write scopes to client-side credential exfiltration. |
| **Deterministic Risk Scoring Algorithm** | Computes an explainable, auditable risk score (0-100) based on modified LOC, touch on auth/migration boundaries, and test coverage deltas without unpredictable LLM hallucinations. | Relying purely on generative AI prompts for risk classification. Rejected because automated CI gates require deterministic, reproducible verdicts for compliance. |

---

## License

Distributed under the [MIT License](LICENSE).

