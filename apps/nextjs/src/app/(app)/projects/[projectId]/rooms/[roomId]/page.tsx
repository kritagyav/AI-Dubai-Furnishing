"use client";

/**
 * Room Detail -- Stories 2.2 (edit dimensions), 2.3 (photos), 2.6 (room type).
 * View and edit room data, manage photos, change room type, detect room type
 * with AI, view package history, and add photos via URL input.
 */
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ErrorState, Spinner } from "@dubai/ui";
import { Button } from "@dubai/ui/button";

import { StatusBadge } from "~/components/StatusBadge";
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
  photos: {
    id: string;
    storageUrl: string;
    thumbnailUrl: string | null;
    orderIndex: number;
    uploadedAt: Date;
  }[];
}

interface PackageItem {
  id: string;
  name: string;
  status: string;
  totalPriceFils: number;
  styleTag: string | null;
  createdAt: Date;
  _count: { items: number };
}

function formatDimension(cm: number | null, unit: string): string {
  if (!cm) return "--";
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
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState<string | null>(null);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");
  const [addingPhoto, setAddingPhoto] = useState(false);

  const loadRoom = useCallback(async () => {
    try {
      const data = await client.room.getRoom.query({ roomId: params.roomId });
      setRoom(data);

      // Load packages for this room
      void client.package.list
        .query({ limit: 50, projectId: data.projectId })
        .then((pkgData) => {
          // The package list API doesn't filter by roomId, so we show all project packages
          // In a real app, we'd add a roomId filter to the list query
          setPackages(pkgData.items as PackageItem[]);
        })
        .catch(() => {
          // Non-critical
        });
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

  async function handleDetectRoomType() {
    if (!room) return;
    setDetecting(true);
    setDetectMessage(null);
    try {
      const result = await client.room.detectRoomType.mutate({
        roomId: room.id,
      });
      const label =
        ROOM_TYPE_LABELS[String(result.type)] ?? String(result.type);
      const confidence = Math.round((result.typeConfidence ?? 0) * 100);
      setDetectMessage(`Detected: ${label} (${confidence}% confidence)`);
      void loadRoom();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Detection failed";
      setDetectMessage(message);
    } finally {
      setDetecting(false);
    }
  }

  async function handleAddPhoto() {
    if (!room || !photoUrl.trim()) return;
    setAddingPhoto(true);
    try {
      await client.room.addPhoto.mutate({
        roomId: room.id,
        storageUrl: photoUrl.trim(),
        orderIndex: room.photos.length,
      });
      setPhotoUrl("");
      void loadRoom();
    } catch {
      // Swallow
    } finally {
      setAddingPhoto(false);
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
                AI suggested ({Math.round((room.typeConfidence ?? 0) * 100)}%
                confidence)
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

      {/* Room Type Selection -- Story 2.6 */}
      <div className="bg-card rounded-lg p-4 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Room Type</h2>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleDetectRoomType}
              disabled={detecting}
            >
              {detecting ? "Detecting..." : "Detect Room Type (AI)"}
            </Button>
          </div>
        </div>
        {detectMessage && (
          <p
            className={`mb-3 text-sm ${
              detectMessage.startsWith("Detected:")
                ? "text-[var(--color-success-default)]"
                : "text-[var(--color-error-default)]"
            }`}
          >
            {detectMessage}
          </p>
        )}
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

      {/* Dimensions -- Story 2.2 */}
      <div className="bg-card rounded-lg p-4 shadow-xs">
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

      {/* Photos -- Story 2.3 */}
      <div className="bg-card rounded-lg p-4 shadow-xs">
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
                  className="bg-background/80 absolute top-1 right-1 hidden rounded p-1 text-xs group-hover:block"
                  aria-label="Delete photo"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add photo by URL */}
        <div className="mt-4">
          <p className="text-muted-foreground mb-2 text-xs">
            Add a photo by entering its URL:
          </p>
          <div className="flex gap-2">
            <input
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="border-input bg-background flex-1 rounded-md border px-3 py-2 text-sm"
            />
            <Button
              size="sm"
              onClick={handleAddPhoto}
              disabled={addingPhoto || !photoUrl.trim()}
            >
              {addingPhoto ? "Adding..." : "Add Photo"}
            </Button>
          </div>
        </div>
      </div>

      {/* Package History */}
      {packages.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-xs">
          <h2 className="mb-3 text-sm font-semibold">
            Package History ({packages.length})
          </h2>
          <div className="space-y-2">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                className="flex items-center justify-between rounded-md border p-3"
              >
                <div>
                  <p className="text-sm font-medium">{pkg.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {pkg._count.items} items
                    {pkg.styleTag ? ` -- ${pkg.styleTag}` : ""}
                    {" -- "}
                    {new Date(pkg.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">
                    AED{" "}
                    {(pkg.totalPriceFils / 100).toLocaleString("en-AE", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <StatusBadge status={pkg.status} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
