import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

vi.mock("@/providers/session", () => ({
  useSession: () => ({
    workspace: { id: "ws-1", name: "Demo Workspace", slug: "demo-workspace" },
    workspaces: [
      { id: "ws-1", name: "Demo Workspace", slug: "demo-workspace" },
      { id: "ws-2", name: "Acme", slug: "acme" },
    ],
    switchWorkspace: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/graphql/mutations", () => ({
  createWorkspace: vi.fn(),
}));

describe("WorkspaceSwitcher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the active workspace", () => {
    render(<WorkspaceSwitcher />);
    expect(screen.getByText("Demo Workspace")).toBeInTheDocument();
  });

  it("lists all workspaces when opened", async () => {
    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher"));
    await waitFor(() => expect(screen.getByText("Acme")).toBeInTheDocument());
  });

  it("offers creating a new workspace", async () => {
    render(<WorkspaceSwitcher />);
    fireEvent.click(screen.getByTestId("workspace-switcher"));
    fireEvent.click(await screen.findByText("New workspace"));
    expect(await screen.findByText("Create workspace")).toBeInTheDocument();
  });
});
