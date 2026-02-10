/**
 * Application error types per architecture decision AC-4.
 *
 * All errors include correlationId linking to server logs.
 * tRPC error codes map to HTTP status codes.
 */

export const APP_ERROR_CODES = {
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  VALIDATION: "BAD_REQUEST",
  CONFLICT: "CONFLICT",
  PAYMENT_FAILED: "INTERNAL_SERVER_ERROR",
  INVENTORY_UNAVAILABLE: "CONFLICT",
  RATE_LIMITED: "TOO_MANY_REQUESTS",
  INTERNAL: "INTERNAL_SERVER_ERROR",
} as const;

export type AppErrorCode = keyof typeof APP_ERROR_CODES;

export interface AppError {
  code: AppErrorCode;
  message: string;
  details?: Record<string, unknown>;
  correlationId: string;
}
