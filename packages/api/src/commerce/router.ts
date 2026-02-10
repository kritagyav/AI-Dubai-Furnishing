import type { TRPCRouterRecord } from "@trpc/server";

import { authedProcedure } from "../trpc";

export const commerceRouter = {
  hello: authedProcedure.query(() => {
    return { message: "commerce router" };
  }),
} satisfies TRPCRouterRecord;
