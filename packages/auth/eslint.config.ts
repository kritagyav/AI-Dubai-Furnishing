import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@dubai/eslint-config/base";
import { reactConfig } from "@dubai/eslint-config/react";

export default defineConfig(
  {
    ignores: ["script/**"],
  },
  baseConfig,
  reactConfig,
  restrictEnvAccess,
);
