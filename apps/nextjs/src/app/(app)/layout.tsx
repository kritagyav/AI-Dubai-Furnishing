import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SidebarInset, SidebarProvider, SidebarTrigger } from "@dubai/ui/sidebar";

import { getSession } from "~/auth/server";
import { AppSidebar } from "~/components/AppSidebar";
import { SessionProvider } from "~/components/SessionProvider";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  return (
    <SidebarProvider>
      <AppSidebar userEmail={user.email ?? ""} />
      <SidebarInset>
        <header className="border-border flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <SessionProvider>
          <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
        </SessionProvider>
      </SidebarInset>
    </SidebarProvider>
  );
}
