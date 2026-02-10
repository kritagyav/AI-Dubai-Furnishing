"use client";

/**
 * Room Detail — Stories 2.2 (edit dimensions), 2.3 (photos), 2.6 (room type).
 * View and edit room data, manage photos, change room type.
 */

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { ErrorState, Spinner } from "@dubai/ui";

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

interface RoomData {
  id: string;
  projectId: string;
  name: string;
  type: string;
  typeConfidence: number | null;
  typeSource: string;
  widthCm: number | null;
  lengthCm: number | null;
  heightCm: number | null;
  displayUnit: string;
  orderIndex: number;
  createdAt: Date;
  updatedAt: Date;
  photos: Array<{
    id: string;
    storageUrl: string;
    thumbnailUrl: string | null;
    orderIndex: number;
    uploadedAt: Date;
  }>;
}

function formatDimension(cm: number | null, unit: string): string {
  if (!cm) return "—";
  if (unit === "IMPERIAL") return `${(cm / 30.48).toFixed(1)} ft`;
  return `${(cm / 100).toFixed(1)} m`;
}

export default function RoomDetailPage() {
  const params = useParams<{ projectId: string; roomId: string }>();
  const client = useTRPCClient();
  const router = useRouter();
  const [room, setRoom] = useState<RoomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadRoom = useCallback(async () => {
    try {
      const data = await client.room.getRoom.query({ roomId: params.roomId });
      setRoom(data);
    } catch {
      setError("Failed to load room");
    } finally {
      setLoading(false);
    }
  }, [client, params.roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  async function handleDeletePhoto(photoId: string) {
    if (!confirm("Delete this photo?")) return;
    try {
      await client.room.deletePhoto.mutate({ photoId });
      void loadRoom();
    } catch {
      // Stay on page
    }
  }

  async function handleChangeType(type: string) {
    if (!room) return;
    try {
      await client.room.setRoomType.mutate({
        roomId: room.id,
        type: type as "LIVING_ROOM",
        source: "MANUAL",
      });
      void loadRoom();
    } catch {
      // Swallow
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="py-20">
        <ErrorState
          title="Room not found"
          message={error ?? "This room doesn't exist."}
          retryLabel="Back to project"
          onRetry={() => router.push(`/projects/${params.projectId}`)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{room.name}</h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="bg-muted text-muted-foreground rounded px-2 py-0.5 text-sm">
              {ROOM_TYPE_LABELS[room.type] ?? room.type}
            </span>
            {room.typeSource === "AI_SUGGESTED" && (
              <span className="text-muted-foreground text-xs">
                AI suggested ({Math.round((room.typeConfidence ?? 0) * 100)}% confidence)
              </span>
            )}
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/projects/${params.projectId}`)}
        >
          Back to project
        </Button>
      </div>

      {/* Room Type Selection — Story 2.6 */}
      <div className="border-border rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Room Type</h2>
        <div className="flex flex-wrap gap-2">
          {Object.entries(ROOM_TYPE_LABELS).map(([value, label]) => (
            <button
              key={value}
              onClick={() => handleChangeType(value)}
              className={`min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm transition-colors ${
                room.type === value
                  ? "border-foreground bg-foreground text-background font-medium"
                  : "border-input hover:border-foreground/30"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Dimensions — Story 2.2 */}
      <div className="border-border rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold">Dimensions</h2>
        <dl className="grid grid-cols-3 gap-4 text-center">
          <div>
            <dt className="text-muted-foreground text-xs">Width</dt>
            <dd className="text-lg font-medium">
              {formatDimension(room.widthCm, room.displayUnit)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Length</dt>
            <dd className="text-lg font-medium">
              {formatDimension(room.lengthCm, room.displayUnit)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Height</dt>
            <dd className="text-lg font-medium">
              {formatDimension(room.heightCm, room.displayUnit)}
            </dd>
          </div>
        </dl>
      </div>

      {/* Photos — Story 2.3 */}
      <div className="border-border rounded-lg border p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">
            Photos ({room.photos.length})
          </h2>
        </div>

        {room.photos.length === 0 ? (
          <p className="text-muted-foreground py-4 text-center text-sm">
            No photos uploaded yet. Photos help the AI generate better packages.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {room.photos.map((photo) => (
              <div key={photo.id} className="group relative">
                <img
                  src={photo.thumbnailUrl ?? photo.storageUrl}
                  alt="Room photo"
                  className="aspect-square w-full rounded-md object-cover"
                />
                <button
                  onClick={() => handleDeletePhoto(photo.id)}
                  className="bg-background/80 absolute right-1 top-1 hidden rounded p-1 text-xs group-hover:block"
                  aria-label="Delete photo"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
