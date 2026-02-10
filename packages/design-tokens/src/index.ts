/**
 * @dubai/design-tokens
 *
 * Three-layer token architecture: Primitive → Semantic → Component.
 * Built via Style Dictionary into CSS custom properties (web) and
 * JS/TS theme objects (React Native).
 *
 * CSS output: import "@dubai/design-tokens/css"
 * JS theme:  import { tokens } from "@dubai/design-tokens"
 */

// Re-export built JS tokens (available after build:tokens)
export { default as tokens } from "../dist/js/tokens.js";

// Re-export React Native theme (available after build:tokens)
export { default as theme } from "../dist/react-native/theme.js";

// Build pipeline exports
export { build, buildTokens, buildZoneTokens } from "./config.js";
