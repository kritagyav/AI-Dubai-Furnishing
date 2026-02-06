import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@dubai/eslint-config/base";
import { nextjsConfig } from "@dubai/eslint-config/nextjs";
import { reactConfig } from "@dubai/eslint-config/react";

export default defineConfig(
  {
    ignores: [".next/**"],
  },
  baseConfig,
  reactConfig,
  nextjsConfig,
  restrictEnvAccess,
);
