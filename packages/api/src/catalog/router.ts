import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "../trpc";

export const catalogRouter = {
  hello: publicProcedure.query(() => {
    return { message: "catalog router" };
  }),
} satisfies TRPCRouterRecord;
