import type { TRPCRouterRecord } from "@trpc/server";

import { retailerProcedure } from "../trpc";

export const retailerRouter = {
  hello: retailerProcedure.query(() => {
    return { message: "retailer router" };
  }),
} satisfies TRPCRouterRecord;
