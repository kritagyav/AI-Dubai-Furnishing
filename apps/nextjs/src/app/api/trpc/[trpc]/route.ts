import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

import { appRouter, createTRPCContext } from "@dubai/api";
import { createEdgeApp } from "@dubai/edge-middleware";

import { createSupabaseServerClient } from "~/auth/server";

const app = createEdgeApp();

app.all("/api/trpc/*", async (c) => {
  const supabase = createSupabaseServerClient();
  const correlationId = c.req.header("x-correlation-id");

  return fetchRequestHandler({
    endpoint: "/api/trpc",
    router: appRouter,
    req: c.req.raw,
    createContext: () =>
      createTRPCContext({
        supabase,
        headers: c.req.raw.headers,
        ...(correlationId ? { correlationId } : {}),
      }),
    onError({ error, path }) {
      console.error(`>>> tRPC Error on '${path}'`, error);
    },
  });
});

const handler = app.fetch;

export { handler as GET, handler as POST };
