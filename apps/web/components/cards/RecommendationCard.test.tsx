import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RecommendationCard } from "./RecommendationCard";
import type { Recommendation } from "@/types/graphql";

const rec: Recommendation = {
  id: "rec-1",
  workspaceId: "ws-1",
  repositoryId: "repo-1",
  type: "SLOW_REVIEWS",
  priority: "HIGH",
  title: "Pull request reviews are slowing delivery",
  reason: "Average first-review time increased by 41%.",
  evidence: { currentAverageHours: 8, previousAverageHours: 5.6 },
  impact: "Delivery cycle time grows as review time rises.",
  suggestedAction: "Review reviewer assignment coverage.",
  status: "ACTIVE",
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("RecommendationCard", () => {
  it("renders title, reason and priority", () => {
    render(<RecommendationCard recommendation={rec} />);
    expect(screen.getByText("Pull request reviews are slowing delivery")).toBeInTheDocument();
    expect(screen.getByText("HIGH")).toBeInTheDocument();
    expect(screen.getByText(/Average first-review time increased/)).toBeInTheDocument();
  });

  it("shows evidence values", () => {
    render(<RecommendationCard recommendation={rec} />);
    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("5.6")).toBeInTheDocument();
  });

  it("shows the suggested action", () => {
    render(<RecommendationCard recommendation={rec} />);
    expect(screen.getByText("Review reviewer assignment coverage.")).toBeInTheDocument();
  });

  it("calls onComplete and onDismiss", () => {
    const onComplete = vi.fn();
    const onDismiss = vi.fn();
    render(<RecommendationCard recommendation={rec} onComplete={onComplete} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /Complete/i }));
    expect(onComplete).toHaveBeenCalledWith("rec-1");
    fireEvent.click(screen.getByRole("button", { name: /Dismiss/i }));
    expect(onDismiss).toHaveBeenCalledWith("rec-1");
  });
});
