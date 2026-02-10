import type { TRPCRouterRecord } from "@trpc/server";

import { supportProcedure } from "../trpc";

export const supportRouter = {
  hello: supportProcedure.query(() => {
    return { message: "support router" };
  }),
} satisfies TRPCRouterRecord;
