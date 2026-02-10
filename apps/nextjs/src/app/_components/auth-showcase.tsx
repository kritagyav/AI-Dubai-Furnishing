import Link from "next/link";

import { Button } from "@dubai/ui/button";

import { getSession } from "~/auth/server";

export async function AuthShowcase() {
  const user = await getSession();

  if (!user) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted-foreground text-sm">Not signed in</p>
        <Button size="lg" asChild>
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {user.email}</span>
      </p>
    </div>
  );
}
