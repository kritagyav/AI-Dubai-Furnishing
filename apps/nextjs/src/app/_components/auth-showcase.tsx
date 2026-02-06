import { Button } from "@dubai/ui/button";

import { getSession } from "~/auth/server";

export async function AuthShowcase() {
  const session = await getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center gap-2">
        <p className="text-muted-foreground text-sm">Not signed in</p>
        <Button size="lg" disabled>
          Sign in (configured in later stories)
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <p className="text-center text-2xl">
        <span>Logged in as {session.user.email}</span>
      </p>
    </div>
  );
}
