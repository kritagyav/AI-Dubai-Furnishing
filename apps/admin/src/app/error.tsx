"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <span className="text-2xl text-red-600">!</span>
      </div>
      <h2 className="text-2xl font-bold text-gray-900">Admin Error</h2>
      <p className="max-w-md text-sm text-gray-600">
        An unexpected error occurred in the admin panel. Please try again.
      </p>
      {error.digest && (
        <p className="font-mono text-xs text-gray-400">
          Error ID: {error.digest}
        </p>
      )}
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="rounded-md bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
        >
          Try Again
        </button>
        <button
          onClick={() => (window.location.href = "/dashboard")}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
