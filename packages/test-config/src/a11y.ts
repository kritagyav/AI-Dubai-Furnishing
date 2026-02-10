import { configureAxe, toHaveNoViolations } from "jest-axe";
import { expect } from "vitest";

// jest-axe types are incompatible with Vitest's MatchersObject
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
expect.extend(toHaveNoViolations as any);

export { axe } from "jest-axe";
export { configureAxe, toHaveNoViolations };
