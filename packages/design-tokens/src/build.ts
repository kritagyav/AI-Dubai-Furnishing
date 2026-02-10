#!/usr/bin/env tsx
/**
 * CLI entry point for the Style Dictionary build pipeline.
 * Run via: pnpm build:tokens
 */
import { build } from "./config.js";

await build();
console.log("✅ Design tokens built successfully");
