import { defineConfig } from "eslint/config";

import { baseConfig, restrictEnvAccess } from "@dubai/eslint-config/base";

export default defineConfig(baseConfig, restrictEnvAccess);
