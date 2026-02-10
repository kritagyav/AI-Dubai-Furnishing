import pino from "pino";

export type Logger = pino.Logger;

/**
 * Creates a structured Pino logger for the given service.
 *
 * - Dev: pino-pretty transport for human-readable output
 * - Prod: plain JSON for log aggregation (Axiom)
 * - Redacts sensitive fields (authorization, password, token, cookie, secret)
 * - ISO timestamps, level as label
 */
export function createLogger(service: string): Logger {
  /* eslint-disable no-restricted-properties -- Logger factory needs raw env access */
  const isDev = process.env.NODE_ENV !== "production";

  return pino({
    name: service,
    level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
    redact: {
      paths: [
        "req.headers.authorization",
        "req.headers.cookie",
        "password",
        "token",
        "secret",
        "accessToken",
        "refreshToken",
      ],
      censor: "[REDACTED]",
    },
    ...(isDev
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:HH:MM:ss.l",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
  });
}
