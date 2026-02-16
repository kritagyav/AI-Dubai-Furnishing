import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "./root";

/**
 * Inference helpers for input types
 * @example
 * type HelloInput = RouterInputs['room']['hello']
 */
type RouterInputs = inferRouterInputs<AppRouter>;

/**
 * Inference helpers for output types
 * @example
 * type HelloOutput = RouterOutputs['room']['hello']
 */
type RouterOutputs = inferRouterOutputs<AppRouter>;

export { type AppRouter, appRouter } from "./root";
export {
  createCallerFactory,
  createTRPCContext,
  auditedProcedure,
} from "./trpc";
export type { RouterInputs, RouterOutputs };
export { type AppError, type AppErrorCode, APP_ERROR_CODES } from "./errors";
