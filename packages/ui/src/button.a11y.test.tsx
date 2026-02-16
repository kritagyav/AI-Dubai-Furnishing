import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { axe } from "@dubai/test-config/a11y";

import { Button } from "./button";

describe("Button accessibility", () => {
  it("has no a11y violations with default variant", async () => {
    const { container } = render(<Button>Click me</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations when disabled", async () => {
    const { container } = render(<Button disabled>Disabled</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });

  it("has no a11y violations with destructive variant", async () => {
    const { container } = render(<Button variant="destructive">Delete</Button>);
    expect(await axe(container)).toHaveNoViolations();
  });
});
