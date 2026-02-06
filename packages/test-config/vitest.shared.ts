// Shared Vitest configuration
// vitest dependency and full config added in Story 1.6

export const sharedTestConfig = {
  globals: true,
  environment: "node" as const,
  include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
  coverage: {
    provider: "v8" as const,
    reporter: ["text", "json", "html"],
  },
};
