import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RepositoryTable } from "./RepositoryTable";
import type { RepositoryConnection, Repository } from "@/types/graphql";

const { mockConnection } = vi.hoisted(() => {
  const repo: Repository = {
    id: "repo-1",
    workspaceId: "ws-1",
    githubId: 1001,
    name: "NEBULA",
    fullName: "acme/NEBULA",
    owner: "acme",
    description: "Observability platform",
    url: "https://github.com/acme/NEBULA",
    defaultBranch: "main",
    isPrivate: false,
    language: "TypeScript",
    techStack: ["Next.js", "MongoDB"],
    topics: [],
    fork: false,
    archived: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    pushedAt: "2026-01-01T00:00:00.000Z",
    starCount: 12,
    forkCount: 3,
    openIssuesCount: 13,
    syncStatus: "SYNCED",
    lastSyncedAt: "2026-01-01T00:00:00.000Z",
    source: "mock",
    enabled: true,
    lastActivityAt: "2026-01-01T00:00:00.000Z",
    counts: { commits: 3200, openPrs: 7, mergedPrs: 120, openIssues: 13, closedIssues: 90, dependencies: 41, outdatedDependencies: 7, securityAlerts: 2, deployments: 6, releases: 9, contributors: 6 },
    health: { repositoryId: "repo-1", overall: 87, label: "HEALTHY", change: -4, breakdown: [], trend: [], explanations: [], risks: [], computedAt: "2026-01-01T00:00:00.000Z" },
  };
  const connection: RepositoryConnection = {
    edges: [{ node: repo, cursor: "c1" }],
    pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: "c1", endCursor: "c1" },
    totalCount: 1,
  };
  return { mockConnection: connection };
});

vi.mock("@/graphql/queries/repositories", () => ({
  fetchRepositories: vi.fn(async () => mockConnection),
}));

import { fetchRepositories } from "@/graphql/queries/repositories";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("RepositoryTable", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders repository rows from the backend", async () => {
    renderWithClient(<RepositoryTable />);
    await waitFor(() => expect(screen.getByText("NEBULA")).toBeInTheDocument());
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
  });

  it("renders an empty state when there are no repositories", async () => {
    vi.mocked(fetchRepositories).mockResolvedValueOnce({ ...mockConnection, edges: [], totalCount: 0 });
    renderWithClient(<RepositoryTable />);
    await waitFor(() => expect(screen.getByText("No repositories connected")).toBeInTheDocument());
  });
});
