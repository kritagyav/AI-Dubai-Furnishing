import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-xl dark:bg-gray-900">
        {children}
      </div>
    </div>
  );
}
