import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import Home from "./page";

describe("Home", () => {
  it("renders the product name", () => {
    render(<Home />);
    expect(screen.getByText("Agency Pulse")).toBeInTheDocument();
  });

  it("renders the headline", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: /COO dashboard/i })).toBeInTheDocument();
  });
});
