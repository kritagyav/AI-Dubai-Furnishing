import type { TRPCRouterRecord } from "@trpc/server";

import { adminProcedure } from "../trpc";

export const adminRouter = {
  hello: adminProcedure.query(() => {
    return { message: "admin router" };
  }),
} satisfies TRPCRouterRecord;
