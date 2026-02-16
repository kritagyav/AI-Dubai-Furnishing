"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Auth error:", error);
  }, [error]);

  return (
    <div className="space-y-4 text-center">
      <h2 className="text-xl font-bold">Authentication Error</h2>
      <p className="text-sm text-gray-600">
        Something went wrong during authentication. Please try again.
      </p>
      <button
        onClick={reset}
        className="rounded-md bg-black px-4 py-2 text-sm text-white hover:bg-gray-800"
      >
        Try Again
      </button>
    </div>
  );
}
