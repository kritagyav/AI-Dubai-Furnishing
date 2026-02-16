"use client";

/**
 * Projects list — Story 2.1: Create & Manage Furnishing Projects.
 * Shows all furnishing projects with room counts and last-updated dates.
 */

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { EmptyState, SkeletonScreen } from "@dubai/ui";

import { useTRPCClient } from "~/trpc/react";

interface ProjectItem {
  id: string;
  name: string;
  address: string | null;
  floorPlanThumbUrl: string | null;
  updatedAt: Date;
  _count: { rooms: number };
}

export default function ProjectsPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    try {
      const result = await client.room.listProjects.query({ limit: 50 });
      setProjects(result.items);
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  if (loading) {
    return (
      <div className="py-20">
        <SkeletonScreen rows={3} />
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="py-20">
        <EmptyState
          title="No projects yet"
          description="Create your first furnishing project to get AI-curated furniture packages for your apartment."
          actionLabel="Create project"
          onAction={() => router.push("/projects/new")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage your furnishing projects
          </p>
        </div>
        <Button onClick={() => router.push("/projects/new")}>
          New Project
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => router.push(`/projects/${project.id}`)}
            className="bg-card hover:shadow-md flex flex-col rounded-lg p-6 shadow-xs text-left transition-all"
          >
            <h2 className="text-lg font-semibold">{project.name}</h2>
            {project.address && (
              <p className="text-muted-foreground mt-1 text-sm">
                {project.address}
              </p>
            )}
            <div className="text-muted-foreground mt-4 flex items-center gap-4 text-xs">
              <span>
                {project._count.rooms}{" "}
                {project._count.rooms === 1 ? "room" : "rooms"}
              </span>
              <span>
                Updated{" "}
                {new Date(project.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
