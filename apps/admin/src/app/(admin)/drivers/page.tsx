"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC, useTRPCClient } from "~/trpc/react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    SCHEDULED: "bg-gray-100 text-gray-800",
    ASSIGNED: "bg-blue-100 text-blue-800",
    EN_ROUTE: "bg-indigo-100 text-indigo-800",
    IN_TRANSIT: "bg-purple-100 text-purple-800",
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

type DriverStatus = "EN_ROUTE" | "ARRIVED" | "COMPLETED";

export default function DriversPage() {
  const today = new Date().toISOString().split("T")[0] ?? "";
  const [dateFilter, setDateFilter] = useState<string>(today);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [driverName, setDriverName] = useState("");
  const [driverPhone, setDriverPhone] = useState("");
  const [vehiclePlate, setVehiclePlate] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [updating, setUpdating] = useState<string | null>(null);

  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const deliveries = useQuery(
    trpc.delivery.listDriverAssignments.queryOptions({
      limit: 100,
      ...(dateFilter ? { fromDate: dateFilter, toDate: dateFilter } : {}),
    }),
  );

  const unassigned =
    deliveries.data?.items.filter(
      (d) => d.status === "SCHEDULED" || d.status === "RESCHEDULED",
    ).length ?? 0;
  const assigned =
    deliveries.data?.items.filter((d) => d.status === "ASSIGNED").length ?? 0;
  const enRoute =
    deliveries.data?.items.filter(
      (d) => d.status === "EN_ROUTE" || d.status === "IN_TRANSIT",
    ).length ?? 0;
  const completed =
    deliveries.data?.items.filter((d) => d.status === "DELIVERED").length ?? 0;

  async function handleAssign(deliveryId: string) {
    if (!driverName || !driverPhone) return;
    setAssigning(true);
    try {
      await client.delivery.assignDriver.mutate({
        deliveryId,
        driverName,
        driverPhone,
        ...(vehiclePlate ? { vehiclePlate } : {}),
      });
      setAssignId(null);
      setDriverName("");
      setDriverPhone("");
      setVehiclePlate("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assign driver");
    } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(deliveryId: string) {
    if (!confirm("Remove driver assignment?")) return;
    try {
      await client.delivery.unassignDriver.mutate({ deliveryId });
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to unassign driver");
    }
  }

  async function handleStatusUpdate(deliveryId: string, status: DriverStatus) {
    setUpdating(deliveryId);
    try {
      await client.delivery.updateDriverStatus.mutate({
        deliveryId,
        status,
      });
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Driver Assignment
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Assign drivers to deliveries and track their status
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Unassigned</p>
          <p className="mt-1 text-2xl font-bold text-gray-600">{unassigned}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Assigned</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{assigned}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">En Route / Arrived</p>
          <p className="mt-1 text-2xl font-bold text-indigo-600">{enRoute}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-green-600">{completed}</p>
        </div>
      </div>

      {/* Date Filter */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm font-medium text-gray-700">Date:</label>
        <input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <span className="text-sm text-gray-500">
          {deliveries.data
            ? `${deliveries.data.items.length} deliveries`
            : "Loading..."}
        </span>
      </div>

      {/* Deliveries Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Time Slot
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Driver
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {deliveries.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading deliveries...
                </td>
              </tr>
            )}
            {deliveries.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No deliveries for this date
                </td>
              </tr>
            )}
            {deliveries.data?.items.map((delivery) => (
              <tr key={delivery.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {delivery.order?.orderRef
                    ? delivery.order.orderRef.slice(0, 8)
                    : delivery.orderId.slice(0, 8)}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {delivery.scheduledSlot ?? "N/A"}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <StatusBadge status={delivery.status as string} />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {delivery.driverName ? (
                    <div>
                      <p className="font-medium">{delivery.driverName}</p>
                      <p className="text-xs text-gray-500">
                        {delivery.driverPhone ?? ""}
                      </p>
                    </div>
                  ) : (
                    <span className="text-gray-400">Unassigned</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {delivery.vehiclePlate ?? "--"}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <div className="flex gap-1">
                    {/* Assign button for unassigned deliveries */}
                    {(delivery.status === "SCHEDULED" ||
                      delivery.status === "RESCHEDULED") && (
                      <button
                        onClick={() => setAssignId(delivery.id)}
                        className="rounded bg-blue-600 px-2 py-1 text-xs font-medium text-white hover:bg-blue-700"
                      >
                        Assign
                      </button>
                    )}

                    {/* Unassign button for assigned deliveries */}
                    {delivery.status === "ASSIGNED" && (
                      <>
                        <button
                          onClick={() => handleUnassign(delivery.id)}
                          className="rounded bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-300"
                        >
                          Unassign
                        </button>
                        <button
                          onClick={() =>
                            handleStatusUpdate(delivery.id, "EN_ROUTE")
                          }
                          disabled={updating === delivery.id}
                          className="rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          En Route
                        </button>
                      </>
                    )}

                    {/* Status transition buttons */}
                    {delivery.status === "EN_ROUTE" && (
                      <button
                        onClick={() =>
                          handleStatusUpdate(delivery.id, "ARRIVED")
                        }
                        disabled={updating === delivery.id}
                        className="rounded bg-purple-600 px-2 py-1 text-xs font-medium text-white hover:bg-purple-700 disabled:opacity-50"
                      >
                        Arrived
                      </button>
                    )}

                    {delivery.status === "IN_TRANSIT" && (
                      <button
                        onClick={() =>
                          handleStatusUpdate(delivery.id, "COMPLETED")
                        }
                        disabled={updating === delivery.id}
                        className="rounded bg-green-600 px-2 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                      >
                        Completed
                      </button>
                    )}

                    {delivery.status === "DELIVERED" && (
                      <span className="text-xs text-green-600">Done</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Assign Driver Modal */}
      {assignId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Assign Driver
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Driver Name
                </label>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="Full name"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+971 XX XXX XXXX"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Vehicle Plate (Optional)
                </label>
                <input
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => setVehiclePlate(e.target.value)}
                  placeholder="e.g. Dubai A 12345"
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setAssignId(null);
                  setDriverName("");
                  setDriverPhone("");
                  setVehiclePlate("");
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssign(assignId)}
                disabled={assigning || !driverName || !driverPhone}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {assigning ? "Assigning..." : "Assign Driver"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
