import type { TRPCRouterRecord } from "@trpc/server";

import { adminProcedure } from "../trpc";

export const analyticsRouter = {
  hello: adminProcedure.query(() => {
    return { message: "analytics router" };
  }),
} satisfies TRPCRouterRecord;
