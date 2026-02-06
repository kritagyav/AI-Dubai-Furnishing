import type { TRPCRouterRecord } from "@trpc/server";
import { z } from "zod/v4";

import { publicProcedure } from "../trpc";

// Placeholder post router - full implementation in later stories
// Drizzle ORM references removed during Prisma migration
export const postRouter = {
  hello: publicProcedure
    .input(z.object({ text: z.string() }))
    .query(({ input }) => {
      return {
        greeting: `Hello ${input.text}`,
      };
    }),
} satisfies TRPCRouterRecord;
