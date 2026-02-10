import { defineConfig } from "eslint/config";

import { baseConfig } from "@dubai/eslint-config/base";
import { reactConfig } from "@dubai/eslint-config/react";

export default defineConfig(
  {
    ignores: ["dist/**", ".storybook/**"],
  },
  baseConfig,
  reactConfig,
);
