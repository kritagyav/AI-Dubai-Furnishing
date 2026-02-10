import { withSentryConfig } from "@sentry/nextjs";
import { withAxiom } from "next-axiom";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

// Import env files to validate at build time. Use jiti so we can load .ts files in here.
await jiti.import("./src/env");

/** @type {import("next").NextConfig} */
const config = {
  turbopack: {
    root: "../..",
  },

  /** Enables hot reloading for local packages without a build step */
  transpilePackages: [
    "@dubai/api",
    "@dubai/auth",
    "@dubai/db",
    "@dubai/shared",
    "@dubai/ui",
    "@dubai/validators",
  ],

  /** Pino requires native modules bundled as external */
  serverExternalPackages: ["pino", "pino-pretty"],

  /** We already do linting and typechecking as separate tasks in CI */
  typescript: { ignoreBuildErrors: true },
};

export default withSentryConfig(withAxiom(config), {
  org: process.env.SENTRY_ORG ?? "",
  project: process.env.SENTRY_PROJECT ?? "",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  tunnelRoute: "/monitoring",
  disableLogger: true,
  automaticVercelMonitors: true,
});
