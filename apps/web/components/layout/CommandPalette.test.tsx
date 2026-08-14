import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "./CommandPalette";

const mockRouter = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
  usePathname: () => "/overview",
}));

vi.mock("@/graphql/queries/activity", () => ({
  fetchSearch: vi.fn(async () => ({
    repositories: [{ id: "r1", name: "NEBULA", fullName: "acme/NEBULA", language: "TypeScript", health: { overall: 87, label: "HEALTHY" } }],
    pullRequests: [],
    issues: [],
    commits: [],
    dependencies: [],
    deployments: [],
    contributors: [],
    recommendations: [],
  })),
}));

vi.mock("@/graphql/mutations", () => ({
  syncWorkspace: vi.fn(),
}));

function renderPalette(open = true) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <CommandPalette open={open} onClose={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe("CommandPalette", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows navigation commands when empty", () => {
    renderPalette();
    expect(screen.getByText("Go to Overview")).toBeInTheDocument();
    expect(screen.getByText("Open Pull Requests")).toBeInTheDocument();
    expect(screen.getByText("Sync Workspace")).toBeInTheDocument();
  });

  it("queries the backend as you type", async () => {
    renderPalette();
    const input = screen.getByRole("textbox", { name: /search/i });
    fireEvent.change(input, { target: { value: "nebula" } });
    await waitFor(() => expect(screen.getByText("NEBULA")).toBeInTheDocument());
  });

  it("navigates when a command is selected", () => {
    renderPalette();
    fireEvent.click(screen.getByText("Go to Overview"));
    expect(mockRouter.push).toHaveBeenCalledWith("/overview");
  });
});
