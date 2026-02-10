"use client";

/**
 * Dashboard — main landing for authenticated users.
 * Redirects to onboarding if the user hasn't selected a path yet.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

export default function DashboardPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [onboardingPath, setOnboardingPath] = useState<string | null>(null);

  useEffect(() => {
    void client.user.getOnboardingStatus
      .query()
      .then((status) => {
        if (status.needsOnboarding) {
          router.replace("/onboarding");
          return;
        }
        setOnboardingPath(status.path);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [client, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {onboardingPath === "FURNISH_NOW"
            ? "Ready to furnish your space. Start by adding a room."
            : "Explore styles and save ideas for when you're ready."}
        </p>
      </div>

      {onboardingPath === "FURNISH_NOW" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="New Project"
            description="Start furnishing a new apartment"
            action="Create project"
            onClick={() => router.push("/projects/new")}
          />
          <DashboardCard
            title="My Projects"
            description="View and manage your furnishing projects"
            action="View projects"
            onClick={() => router.push("/projects")}
          />
          <DashboardCard
            title="Order History"
            description="Track deliveries and view past orders"
            action="View orders"
            onClick={() => router.push("/orders")}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DashboardCard
            title="Style Gallery"
            description="Browse completed apartments by style"
            action="Browse gallery"
            onClick={() => router.push("/gallery")}
          />
          <DashboardCard
            title="Saved Packages"
            description="Review packages you've saved"
            action="View saved"
            onClick={() => router.push("/saved")}
          />
          <DashboardCard
            title="Start Furnishing"
            description="Ready to furnish? Create your first project"
            action="Get started"
            onClick={() => router.push("/projects/new")}
          />
        </div>
      )}
    </div>
  );
}

function DashboardCard({
  title,
  description,
  action,
  onClick,
}: {
  title: string;
  description: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <div className="border-border flex flex-col justify-between rounded-lg border p-6">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </div>
      <div className="mt-4">
        <Button variant="outline" size="sm" onClick={onClick}>
          {action}
        </Button>
      </div>
    </div>
  );
}
