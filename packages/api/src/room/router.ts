import type { TRPCRouterRecord } from "@trpc/server";

import { publicProcedure } from "../trpc";

export const roomRouter = {
  hello: publicProcedure.query(() => {
    return { message: "room router" };
  }),
} satisfies TRPCRouterRecord;
