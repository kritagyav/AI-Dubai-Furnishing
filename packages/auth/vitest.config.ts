import { defineConfig, mergeConfig } from "vitest/config";

import sharedConfig from "@dubai/test-config/vitest";

export default mergeConfig(sharedConfig, defineConfig({}));
