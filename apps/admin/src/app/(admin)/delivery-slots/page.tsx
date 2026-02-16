"use client";

import { useState } from "react";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const AREAS = [
  "DUBAI_MARINA",
  "DOWNTOWN",
  "JBR",
  "BUSINESS_BAY",
  "PALM_JUMEIRAH",
  "JLT",
  "DEIRA",
  "BUR_DUBAI",
] as const;

export default function DeliverySlotsPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [viewDate, setViewDate] = useState(
    new Date().toISOString().split("T")[0] ?? "",
  );
  const [viewArea, setViewArea] = useState("");

  // Create form state
  const [createDate, setCreateDate] = useState("");
  const [createArea, setCreateArea] = useState("");
  const [creating, setCreating] = useState(false);

  const slots = useQuery(
    trpc.delivery.listSlots.queryOptions({
      date: viewDate || new Date().toISOString().split("T")[0]!,
      ...(viewArea ? { area: viewArea } : {}),
    }),
  );

  async function handleCreateSlots() {
    if (!createDate || !createArea) return;
    setCreating(true);
    try {
      const result = await client.delivery.createSlots.mutate({
        date: createDate,
        area: createArea,
      });
      alert(`Created ${result.created} delivery slots`);
      setCreateDate("");
      setCreateArea("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create slots");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Delivery Slot Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Create and manage delivery time slots by area and date
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Create Slots Form */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Create New Slots
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={createDate}
                onChange={(e) => setCreateDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Area
              </label>
              <select
                value={createArea}
                onChange={(e) => setCreateArea(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select area</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleCreateSlots}
              disabled={creating || !createDate || !createArea}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Standard Slots (4 time windows)"}
            </button>
            <p className="text-xs text-gray-400">
              Creates 09:00-12:00, 12:00-15:00, 15:00-18:00, 18:00-21:00 slots
              with capacity of 10 each
            </p>
          </div>
        </div>

        {/* View Filters */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Browse Slots
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                value={viewDate}
                onChange={(e) => setViewDate(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Area (optional)
              </label>
              <select
                value={viewArea}
                onChange={(e) => setViewArea(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All areas</option>
                {AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div className="rounded-md bg-gray-50 p-3 text-sm text-gray-600">
              {slots.data
                ? `Showing ${slots.data.length} slots for ${viewDate}`
                : "Loading slots..."}
            </div>
          </div>
        </div>
      </div>

      {/* Slots Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Time Window
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Area
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Capacity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Booked
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Available
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {slots.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading slots...
                </td>
              </tr>
            )}
            {slots.data?.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No slots found for the selected date
                </td>
              </tr>
            )}
            {slots.data?.map((slot) => (
              <tr key={slot.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {new Date(slot.date).toLocaleDateString()}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {slot.startTime} - {slot.endTime}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {slot.area ? slot.area.replace(/_/g, " ") : "All"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {slot.capacity}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {slot.booked}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      slot.available > 0
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {slot.available}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
