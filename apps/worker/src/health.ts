import { createServer } from "node:http";

import { logger } from "./logger";

// eslint-disable-next-line no-restricted-properties -- Health server reads port before env validation
const PORT = parseInt(process.env.WORKER_HEALTH_PORT ?? "9090", 10);

/**
 * Lightweight HTTP health check server for the worker process.
 * Used by BetterStack / container orchestrators for liveness probes.
 */
export function startHealthServer() {
  const server = createServer((_req, res) => {
    const health = {
      status: "ok",
      service: "worker",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(health));
  });

  server.listen(PORT, () => {
    logger.info({ port: PORT }, "Worker health server listening");
  });

  return server;
}
