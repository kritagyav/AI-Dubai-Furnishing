import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "../trpc";

export const packageRouter = {
  hello: publicProcedure.query(() => {
    return { message: "package router" };
  }),
} satisfies TRPCRouterRecord;
