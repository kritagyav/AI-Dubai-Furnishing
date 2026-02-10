"use client";

import { useSuspenseQuery } from "@tanstack/react-query";
import { cn } from "@dubai/ui";

import { useTRPC } from "~/trpc/react";

export function HelloCard() {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.room.hello.queryOptions(),
  );

  return (
    <div className="bg-muted rounded-lg p-4">
      <p className="text-primary text-xl font-bold">{data.message}</p>
    </div>
  );
}

export function PostCardSkeleton(props: { pulse?: boolean }) {
  const { pulse = true } = props;
  return (
    <div className="bg-muted flex flex-row rounded-lg p-4">
      <div className="grow">
        <h2
          className={cn(
            "bg-primary w-1/4 rounded-sm text-2xl font-bold",
            pulse && "animate-pulse",
          )}
        >
          &nbsp;
        </h2>
      </div>
    </div>
  );
}
