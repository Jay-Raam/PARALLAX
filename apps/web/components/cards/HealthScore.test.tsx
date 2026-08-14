import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { HealthScore, healthLabel } from "./HealthScore";

describe("HealthScore", () => {
  it("renders the numeric score", () => {
    render(<HealthScore score={87} />);
    expect(screen.getByText("87")).toBeInTheDocument();
  });

  it("renders the healthy label for high scores", () => {
    render(<HealthScore score={87} />);
    expect(screen.getByText("HEALTHY")).toBeInTheDocument();
  });

  it("shows the weekly change with sign", () => {
    render(<HealthScore score={80} change={-4} />);
    expect(screen.getByText("-4 this week")).toBeInTheDocument();
    expect(screen.getByText("Declining")).toBeInTheDocument();
  });

  it("shows improving state for positive change", () => {
    render(<HealthScore score={80} change={3} />);
    expect(screen.getByText("+3 this week")).toBeInTheDocument();
    expect(screen.getByText("Improving")).toBeInTheDocument();
  });

  it("labels by thresholds", () => {
    expect(healthLabel(90)).toBe("HEALTHY");
    expect(healthLabel(75)).toBe("GOOD");
    expect(healthLabel(60)).toBe("NEEDS ATTENTION");
    expect(healthLabel(40)).toBe("AT RISK");
  });
});
