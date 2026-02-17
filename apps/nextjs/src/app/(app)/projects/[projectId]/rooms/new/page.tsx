"use client";

/**
 * New Room — Stories 2.2 (dimensions), 2.5 (multi-room), 2.6 (room type).
 * Room input form with type selection, dimension entry, "add another" flow,
 * room list panel, progress indicator, and session draft persistence.
 */
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

const ROOM_TYPES = [
  { value: "LIVING_ROOM", label: "Living Room" },
  { value: "BEDROOM", label: "Bedroom" },
  { value: "DINING_ROOM", label: "Dining Room" },
  { value: "KITCHEN", label: "Kitchen" },
  { value: "BATHROOM", label: "Bathroom" },
  { value: "STUDY_OFFICE", label: "Study / Office" },
  { value: "BALCONY", label: "Balcony" },
  { value: "OTHER", label: "Other" },
] as const;

type RoomType = (typeof ROOM_TYPES)[number]["value"];

/** Convert display value to cm based on unit. */
function toCm(value: string, unit: "METRIC" | "IMPERIAL"): number | undefined {
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return undefined;
  if (unit === "IMPERIAL") return Math.round(num * 30.48); // feet → cm
  return Math.round(num * 100); // meters → cm
}

interface ExistingRoom {
  id: string;
  name: string;
  type: string;
}

const DRAFT_KEY_PREFIX = "room-draft-";

function readDraft(projectId: string): Record<string, unknown> | null {
  try {
    const saved = sessionStorage.getItem(DRAFT_KEY_PREFIX + projectId);
    if (saved) return JSON.parse(saved) as Record<string, unknown>;
  } catch {
    // Ignore parse errors
  }
  return null;
}

export default function NewRoomPage() {
  const params = useParams<{ projectId: string }>();
  const client = useTRPCClient();
  const router = useRouter();

  const [name, setName] = useState(() => {
    const d = readDraft(params.projectId);
    return typeof d?.name === "string" ? d.name : "";
  });
  const [type, setType] = useState<RoomType>(() => {
    const d = readDraft(params.projectId);
    return typeof d?.type === "string" ? (d.type as RoomType) : "OTHER";
  });
  const [width, setWidth] = useState(() => {
    const d = readDraft(params.projectId);
    return typeof d?.width === "string" ? d.width : "";
  });
  const [length, setLength] = useState(() => {
    const d = readDraft(params.projectId);
    return typeof d?.length === "string" ? d.length : "";
  });
  const [height, setHeight] = useState(() => {
    const d = readDraft(params.projectId);
    return typeof d?.height === "string" ? d.height : "";
  });
  const [unit, setUnit] = useState<"METRIC" | "IMPERIAL">(() => {
    const d = readDraft(params.projectId);
    return d?.unit === "METRIC" || d?.unit === "IMPERIAL" ? d.unit : "METRIC";
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomsAdded, setRoomsAdded] = useState(0);
  const [existingRooms, setExistingRooms] = useState<ExistingRoom[]>([]);

  const draftKey = DRAFT_KEY_PREFIX + params.projectId;

  // Load existing rooms on mount — same pattern as project/room detail pages
  const loadExistingRooms = useCallback(async () => {
    try {
      const data = await client.room.getProject.query({
        projectId: params.projectId,
      });
      const rooms: ExistingRoom[] = data.rooms.map((r) => ({
        id: String(r.id),
        name: String(r.name),
        type: String(r.type),
      }));
      setExistingRooms(rooms);
    } catch {
      // Non-critical
    }
  }, [client, params.projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- async fetch on mount, same pattern as loadProject/loadRoom
    void loadExistingRooms();
  }, [loadExistingRooms]);

  // Save draft to sessionStorage on form changes
  useEffect(() => {
    try {
      sessionStorage.setItem(
        draftKey,
        JSON.stringify({ name, type, width, length, height, unit }),
      );
    } catch {
      // Storage full or unavailable
    }
  }, [draftKey, name, type, width, length, height, unit]);

  function clearDraft() {
    try {
      sessionStorage.removeItem(draftKey);
    } catch {
      // Ignore
    }
  }

  async function handleSubmit(addAnother: boolean) {
    setError(null);
    setSubmitting(true);

    const widthCm = toCm(width, unit);
    const lengthCm = toCm(length, unit);
    const heightCm = toCm(height, unit);

    try {
      const newRoom = await client.room.createRoom.mutate({
        projectId: params.projectId,
        name,
        type,
        widthCm,
        lengthCm,
        heightCm,
        displayUnit: unit,
      });

      setRoomsAdded((prev) => prev + 1);
      setExistingRooms((prev) => [
        ...prev,
        { id: newRoom.id, name, type },
      ]);

      if (addAnother) {
        // Reset form for next room
        setName("");
        setType("OTHER");
        setWidth("");
        setLength("");
        setHeight("");
        setSubmitting(false);
        clearDraft();
      } else {
        clearDraft();
        router.push(`/projects/${params.projectId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add room");
      setSubmitting(false);
    }
  }

  const unitLabel = unit === "METRIC" ? "m" : "ft";
  const totalRooms = existingRooms.length;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Add Room</h1>
        <p className="text-muted-foreground mt-1">
          {roomsAdded > 0
            ? `${roomsAdded} room${roomsAdded > 1 ? "s" : ""} added this session. Add another or finish.`
            : "Enter room details to get personalized furnishing packages."}
        </p>
      </div>

      {/* Progress indicator */}
      {totalRooms > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            {existingRooms.map((_, i) => (
              <div
                key={i}
                className="bg-foreground h-2.5 w-2.5 rounded-full"
              />
            ))}
            <div className="bg-foreground/40 h-2.5 w-2.5 animate-pulse rounded-full" />
          </div>
          <span className="text-muted-foreground text-sm">
            Adding room {totalRooms + 1}
          </span>
        </div>
      )}

      {/* Existing rooms list */}
      {existingRooms.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-xs">
          <h2 className="mb-2 text-sm font-semibold">
            Rooms ({existingRooms.length})
          </h2>
          <div className="space-y-1.5">
            {existingRooms.map((room) => (
              <Link
                key={room.id}
                href={`/projects/${params.projectId}/rooms/${room.id}`}
                className="hover:bg-muted flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors"
              >
                <span className="font-medium">{room.name}</span>
                <span className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-xs">
                  {ROOM_TYPES.find((rt) => rt.value === room.type)?.label ?? room.type}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Room Name */}
        <div className="space-y-2">
          <label htmlFor="room-name" className="text-sm font-medium">
            Room Name <span className="text-destructive">*</span>
          </label>
          <input
            id="room-name"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Master Bedroom"
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>

        {/* Room Type */}
        <div className="space-y-2">
          <label htmlFor="room-type" className="text-sm font-medium">
            Room Type
          </label>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {ROOM_TYPES.map((rt) => (
              <button
                key={rt.value}
                type="button"
                onClick={() => setType(rt.value)}
                className={`min-h-[44px] min-w-[44px] rounded-md border px-3 py-2 text-sm transition-colors ${
                  type === rt.value
                    ? "border-foreground bg-foreground text-background font-medium"
                    : "border-input hover:border-foreground/30"
                }`}
              >
                {rt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Unit Toggle */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">Units:</span>
          <div className="border-input flex rounded-md border">
            <button
              type="button"
              onClick={() => setUnit("METRIC")}
              className={`min-h-[44px] px-4 py-2 text-sm ${
                unit === "METRIC"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              Meters
            </button>
            <button
              type="button"
              onClick={() => setUnit("IMPERIAL")}
              className={`min-h-[44px] px-4 py-2 text-sm ${
                unit === "IMPERIAL"
                  ? "bg-foreground text-background"
                  : "hover:bg-muted"
              }`}
            >
              Feet
            </button>
          </div>
        </div>

        {/* Dimensions */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <label htmlFor="width" className="text-sm font-medium">
              Width ({unitLabel})
            </label>
            <input
              id="width"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={width}
              onChange={(e) => setWidth(e.target.value)}
              placeholder={unit === "METRIC" ? "e.g. 4.5" : "e.g. 15"}
              className="border-input bg-background min-h-[44px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="length" className="text-sm font-medium">
              Length ({unitLabel})
            </label>
            <input
              id="length"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={length}
              onChange={(e) => setLength(e.target.value)}
              placeholder={unit === "METRIC" ? "e.g. 5.0" : "e.g. 16"}
              className="border-input bg-background min-h-[44px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="height" className="text-sm font-medium">
              Height ({unitLabel})
            </label>
            <input
              id="height"
              type="number"
              inputMode="decimal"
              step="0.1"
              min="0"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder={unit === "METRIC" ? "e.g. 2.8" : "e.g. 9"}
              className="border-input bg-background min-h-[44px] w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        {/* Actions — Story 2.5: multi-room "Add another" */}
        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => handleSubmit(false)}
            disabled={submitting || !name.trim()}
          >
            {submitting ? "Saving..." : "Save & Done"}
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSubmit(true)}
            disabled={submitting || !name.trim()}
          >
            Save & Add Another
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              clearDraft();
              router.back();
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
