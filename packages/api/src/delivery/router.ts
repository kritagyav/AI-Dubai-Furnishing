import type { TRPCRouterRecord } from "@trpc/server";

import { authedProcedure } from "../trpc";

export const deliveryRouter = {
  hello: authedProcedure.query(() => {
    return { message: "delivery router" };
  }),
} satisfies TRPCRouterRecord;
