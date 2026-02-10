"use client";

/**
 * Project Detail — Stories 2.1-2.6.
 * Shows project overview with room list, floor plan, and room management.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { EmptyState, ErrorState, Spinner } from "@dubai/ui";

import { useTRPCClient } from "~/trpc/react";

const ROOM_TYPE_LABELS: Record<string, string> = {
  LIVING_ROOM: "Living Room",
  BEDROOM: "Bedroom",
  DINING_ROOM: "Dining Room",
  KITCHEN: "Kitchen",
  BATHROOM: "Bathroom",
  STUDY_OFFICE: "Study / Office",
  BALCONY: "Balcony",
  OTHER: "Other",
};

interface ProjectData {
  id: string;
  name: string;
  address: string | null;
  floorPlanUrl: string | null;
  floorPlanThumbUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  rooms: Array<{
    id: string;
    name: string;
    type: string;
    widthCm: number | null;
    lengthCm: number | null;
    heightCm: number | null;
    displayUnit: string;
    orderIndex: number;
    _count: { photos: number };
  }>;
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const client = useTRPCClient();
  const router = useRouter();
  const [project, setProject] = useState<ProjectData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAddress, setEditAddress] = useState("");

  const loadProject = useCallback(async () => {
    try {
      const data = await client.room.getProject.query({ projectId: params.projectId });
      setProject(data);
      setEditName(data.name);
      setEditAddress(data.address ?? "");
    } catch {
      setError("Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [client, params.projectId]);

  useEffect(() => {
    void loadProject();
  }, [loadProject]);

  async function handleUpdateProject() {
    if (!project) return;
    try {
      await client.room.updateProject.mutate({
        projectId: project.id,
        name: editName,
        address: editAddress || null,
      });
      setEditing(false);
      void loadProject();
    } catch {
      // Keep editing open on failure
    }
  }

  async function handleDeleteProject() {
    if (!project || !confirm("Delete this project and all its rooms?")) return;
    try {
      await client.room.deleteProject.mutate({ projectId: project.id });
      router.push("/projects");
    } catch {
      // Stay on page on failure
    }
  }

  async function handleDeleteRoom(roomId: string) {
    if (!confirm("Delete this room?")) return;
    try {
      await client.room.deleteRoom.mutate({ roomId });
      void loadProject();
    } catch {
      // Swallow — user sees no change
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="py-20">
        <ErrorState
          title="Project not found"
          message={error ?? "This project doesn't exist or you don't have access."}
          retryLabel="Back to projects"
          onRetry={() => router.push("/projects")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        {editing ? (
          <div className="flex-1 space-y-3">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="border-input bg-background w-full max-w-md rounded-md border px-3 py-2 text-lg font-semibold"
            />
            <input
              type="text"
              value={editAddress}
              onChange={(e) => setEditAddress(e.target.value)}
              placeholder="Address"
              className="border-input bg-background w-full max-w-md rounded-md border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleUpdateProject}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div>
            <h1 className="text-3xl font-bold">{project.name}</h1>
            {project.address && (
              <p className="text-muted-foreground mt-1">{project.address}</p>
            )}
          </div>
        )}
        {!editing && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="outline" size="sm" onClick={handleDeleteProject}>
              Delete
            </Button>
          </div>
        )}
      </div>

      {/* Floor Plan Section */}
      {project.floorPlanUrl && (
        <div className="border-border rounded-lg border p-4">
          <h2 className="mb-3 text-lg font-semibold">Floor Plan</h2>
          <img
            src={project.floorPlanThumbUrl ?? project.floorPlanUrl}
            alt="Floor plan"
            className="max-h-64 rounded object-contain"
          />
        </div>
      )}

      {/* Rooms Section */}
      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            Rooms ({project.rooms.length})
          </h2>
          <Button
            size="sm"
            onClick={() =>
              router.push(`/projects/${project.id}/rooms/new`)
            }
          >
            Add Room
          </Button>
        </div>

        {project.rooms.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            description="Add rooms with dimensions to get AI-generated furnishing packages."
            actionLabel="Add first room"
            onAction={() =>
              router.push(`/projects/${project.id}/rooms/new`)
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {project.rooms.map((room) => (
              <div
                key={room.id}
                className="border-border flex items-start justify-between rounded-lg border p-4"
              >
                <button
                  onClick={() =>
                    router.push(`/projects/${project.id}/rooms/${room.id}`)
                  }
                  className="flex-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{room.name}</span>
                    <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-xs">
                      {ROOM_TYPE_LABELS[room.type] ?? room.type}
                    </span>
                  </div>
                  {room.widthCm && room.lengthCm && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {room.displayUnit === "IMPERIAL"
                        ? `${(room.widthCm / 30.48).toFixed(1)}' × ${(room.lengthCm / 30.48).toFixed(1)}'`
                        : `${(room.widthCm / 100).toFixed(1)}m × ${(room.lengthCm / 100).toFixed(1)}m`}
                      {room.heightCm
                        ? room.displayUnit === "IMPERIAL"
                          ? ` × ${(room.heightCm / 30.48).toFixed(1)}' h`
                          : ` × ${(room.heightCm / 100).toFixed(1)}m h`
                        : ""}
                    </p>
                  )}
                  <p className="text-muted-foreground mt-1 text-xs">
                    {room._count.photos} photo{room._count.photos !== 1 ? "s" : ""}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteRoom(room.id)}
                  aria-label={`Delete ${room.name}`}
                >
                  &times;
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Project Summary */}
      <div className="border-border rounded-lg border p-4">
        <h2 className="mb-3 text-lg font-semibold">Summary</h2>
        <dl className="text-muted-foreground grid grid-cols-2 gap-2 text-sm">
          <dt>Rooms</dt>
          <dd>{project.rooms.length}</dd>
          <dt>Input methods</dt>
          <dd>
            {[
              project.rooms.some((r) => r.widthCm) ? "Manual dimensions" : null,
              project.rooms.some((r) => r._count.photos > 0) ? "Photos" : null,
              project.floorPlanUrl ? "Floor plan" : null,
            ]
              .filter(Boolean)
              .join(", ") || "None yet"}
          </dd>
          <dt>Created</dt>
          <dd>{new Date(project.createdAt).toLocaleDateString()}</dd>
        </dl>
      </div>
    </div>
  );
}
