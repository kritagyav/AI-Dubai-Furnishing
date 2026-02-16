"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC, useTRPCClient } from "~/trpc/react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SCHEDULED: "bg-blue-100 text-blue-800",
    IN_TRANSIT: "bg-indigo-100 text-indigo-800",
    DELIVERED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
    RESCHEDULED: "bg-yellow-100 text-yellow-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function DeliveriesPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const [slotDate, setSlotDate] = useState("");
  const [slotArea, setSlotArea] = useState("");
  const [creating, setCreating] = useState(false);

  const deliveries = useQuery(
    trpc.delivery.listAll.queryOptions({ limit: 50 }),
  );

  const scheduled =
    deliveries.data?.items.filter((d) => d.status === "SCHEDULED").length ?? 0;
  const inTransit =
    deliveries.data?.items.filter((d) => d.status === "IN_TRANSIT").length ?? 0;
  const delivered =
    deliveries.data?.items.filter((d) => d.status === "DELIVERED").length ?? 0;
  const failed =
    deliveries.data?.items.filter((d) => d.status === "FAILED").length ?? 0;

  async function handleCreateSlots() {
    if (!slotDate || !slotArea) return;
    setCreating(true);
    try {
      const result = await client.delivery.createSlots.mutate({
        date: slotDate,
        area: slotArea,
      });
      alert(`Created ${result.created} delivery slots`);
      setSlotDate("");
      setSlotArea("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create slots");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Delivery Operations
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage delivery slots, track shipments, and resolve issues
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Scheduled</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{scheduled}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">In Transit</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{inTransit}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Delivered</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{delivered}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Issues</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{failed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Create Delivery Slots */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Create Delivery Slots
          </h2>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={slotDate}
                onChange={(e) => setSlotDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Area
              </label>
              <select
                value={slotArea}
                onChange={(e) => setSlotArea(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select area</option>
                <option value="DUBAI_MARINA">Dubai Marina</option>
                <option value="DOWNTOWN">Downtown</option>
                <option value="JBR">JBR</option>
                <option value="BUSINESS_BAY">Business Bay</option>
                <option value="PALM_JUMEIRAH">Palm Jumeirah</option>
                <option value="JLT">JLT</option>
                <option value="DEIRA">Deira</option>
                <option value="BUR_DUBAI">Bur Dubai</option>
              </select>
            </div>
            <button
              onClick={handleCreateSlots}
              disabled={creating || !slotDate || !slotArea}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create 4 Slots"}
            </button>
          </div>
        </div>

        {/* Active Deliveries */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Active Deliveries
          </h2>
          {deliveries.isLoading && (
            <p className="py-8 text-center text-sm text-gray-400">Loading...</p>
          )}
          {deliveries.data?.items.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-400">
              No deliveries scheduled
            </p>
          )}
          <div className="space-y-2">
            {deliveries.data?.items.slice(0, 10).map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between rounded-md border border-gray-100 p-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {new Date(d.scheduledDate).toLocaleDateString()} &middot;{" "}
                    {d.scheduledSlot ?? "N/A"}
                  </p>
                  <p className="text-xs text-gray-500">
                    {d.driverName ?? "Unassigned"}
                  </p>
                </div>
                <StatusBadge status={d.status as string} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
