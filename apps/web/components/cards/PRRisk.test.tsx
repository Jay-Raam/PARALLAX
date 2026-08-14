import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PRRiskPanel } from "./PRDetail";
import type { PullRequest } from "@/types/graphql";

const pr: PullRequest = {
  id: "pr-1",
  repositoryId: "repo-1",
  githubNumber: 182,
  title: "Add payment retry system",
  body: null,
  state: "OPEN",
  authorLogin: "jayraam",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: null,
  closedAt: null,
  mergedAt: null,
  baseRef: "main",
  headRef: "feat/payment-retry",
  additions: 842,
  deletions: 211,
  changedFiles: 27,
  commits: 12,
  isDraft: false,
  labels: [],
  reviewDecision: null,
  reviewTimeMs: null,
  approvalTimeMs: null,
  mergeTimeMs: null,
  deployTimeMs: null,
  testFilesChanged: 0,
  dependenciesChanged: 2,
  authFilesChanged: 1,
  migrationFilesChanged: 1,
  files: [],
  lifecycle: [],
  reviews: [],
  risk: {
    score: 64,
    level: "MEDIUM",
    factors: ["Authentication middleware modified", "Payment service modified", "No test files changed"],
    explanation: "This change touches critical paths without test coverage.",
  },
};

describe("PRRiskPanel", () => {
  it("renders the risk score", () => {
    render(<PRRiskPanel pr={pr} />);
    expect(screen.getByText("64")).toBeInTheDocument();
    expect(screen.getByText("MEDIUM")).toBeInTheDocument();
  });

  it("renders risk factors", () => {
    render(<PRRiskPanel pr={pr} />);
    expect(screen.getByText("Authentication middleware modified")).toBeInTheDocument();
    expect(screen.getByText("No test files changed")).toBeInTheDocument();
  });

  it("renders the explanation", () => {
    render(<PRRiskPanel pr={pr} />);
    expect(screen.getByText(/touches critical paths/)).toBeInTheDocument();
  });

  it("renders nothing when there is no risk data", () => {
    const { container } = render(<PRRiskPanel pr={{ ...pr, risk: null }} />);
    expect(container.firstChild).toBeNull();
  });
});
