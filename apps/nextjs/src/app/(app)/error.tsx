"use client";

import { useEffect } from "react";

import { ErrorState } from "@dubai/ui";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center">
      <ErrorState
        title="Something went wrong"
        message="An unexpected error occurred. Please try again or contact support if the problem persists."
        retryLabel="Try Again"
        onRetry={reset}
        secondaryLabel="Back to Dashboard"
        onSecondary={() => (window.location.href = "/dashboard")}
        {...(error.digest ? { correlationId: error.digest } : {})}
      />
    </div>
  );
}
