import react from "@vitejs/plugin-react";
import { defineConfig, mergeConfig } from "vitest/config";

import sharedConfig from "@dubai/test-config/vitest";

export default mergeConfig(
  sharedConfig,
  defineConfig({
    plugins: [react()],
    test: {
      environment: "jsdom",
      include: [
        "src/**/*.test.ts",
        "src/**/*.test.tsx",
        "src/**/*.spec.ts",
        "src/**/*.spec.tsx",
      ],
    },
  }),
);
