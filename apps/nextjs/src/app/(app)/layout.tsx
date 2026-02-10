import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { getSession } from "~/auth/server";
import { SessionProvider } from "~/components/SessionProvider";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-border border-b">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4">
          <Link href="/dashboard" className="text-lg font-semibold">
            Dubai Furnishing
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings/profile">Settings</Link>
            </Button>
            <span className="text-muted-foreground text-sm">{user.email}</span>
          </nav>
        </div>
      </header>
      <SessionProvider>
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </SessionProvider>
    </div>
  );
}
