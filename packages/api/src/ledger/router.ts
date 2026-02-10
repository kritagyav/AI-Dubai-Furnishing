import type { TRPCRouterRecord } from "@trpc/server";

import { adminProcedure } from "../trpc";

export const ledgerRouter = {
  hello: adminProcedure.query(() => {
    return { message: "ledger router" };
  }),
} satisfies TRPCRouterRecord;
