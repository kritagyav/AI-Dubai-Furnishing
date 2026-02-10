import type { TRPCRouterRecord } from "@trpc/server";

import { authedProcedure } from "../trpc";

export const engagementRouter = {
  hello: authedProcedure.query(() => {
    return { message: "engagement router" };
  }),
} satisfies TRPCRouterRecord;
