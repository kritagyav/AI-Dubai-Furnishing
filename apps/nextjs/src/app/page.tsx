import { Suspense } from "react";

import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { AuthShowcase } from "./_components/auth-showcase";
import { HelloCard, PostCardSkeleton } from "./_components/posts";

export default function HomePage() {
  prefetch(trpc.room.hello.queryOptions());

  return (
    <HydrateClient>
      <main className="container h-screen py-16">
        <div className="flex flex-col items-center justify-center gap-4">
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            Dubai <span className="text-primary">Furnishing</span>
          </h1>
          <AuthShowcase />

          <div className="w-full max-w-2xl">
            <Suspense fallback={<PostCardSkeleton />}>
              <HelloCard />
            </Suspense>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
