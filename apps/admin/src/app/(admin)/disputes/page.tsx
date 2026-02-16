"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC, useTRPCClient } from "~/trpc/react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-red-100 text-red-800",
    IN_PROGRESS: "bg-yellow-100 text-yellow-800",
    WAITING_ON_CUSTOMER: "bg-orange-100 text-orange-800",
    RESOLVED: "bg-green-100 text-green-800",
    CLOSED: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

function OrderStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PAID: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    DISPUTED: "bg-red-100 text-red-800",
    REFUNDED: "bg-orange-100 text-orange-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const TICKET_STATUSES = [
  "",
  "OPEN",
  "IN_PROGRESS",
  "WAITING_ON_CUSTOMER",
  "RESOLVED",
  "CLOSED",
] as const;

const RESOLUTION_TYPES = [
  { value: "FULL_REFUND", label: "Full Refund" },
  { value: "PARTIAL_REFUND", label: "Partial Refund" },
  { value: "REPLACEMENT", label: "Replacement" },
  { value: "REJECTED", label: "Rejected" },
] as const;

type ResolutionType =
  | "FULL_REFUND"
  | "PARTIAL_REFUND"
  | "REPLACEMENT"
  | "REJECTED";
type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

export default function DisputesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ResolutionType>("FULL_REFUND");
  const [refundAmount, setRefundAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [resolving, setResolving] = useState(false);

  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const disputes = useQuery(
    trpc.commerce.listDisputes.queryOptions({
      limit: 50,
      ...(statusFilter ? { status: statusFilter as TicketStatus } : {}),
    }),
  );

  const openCount =
    disputes.data?.items.filter((d) => d.status === "OPEN").length ?? 0;
  const inProgressCount =
    disputes.data?.items.filter((d) => d.status === "IN_PROGRESS").length ?? 0;
  const resolvedCount =
    disputes.data?.items.filter((d) => d.status === "RESOLVED").length ?? 0;

  async function handleResolve(ticketId: string) {
    setResolving(true);
    try {
      await client.commerce.resolveDispute.mutate({
        ticketId,
        resolution,
        ...(resolution === "PARTIAL_REFUND" && refundAmount
          ? { refundAmountFils: Math.round(parseFloat(refundAmount) * 100) }
          : {}),
        ...(notes ? { notes } : {}),
      });
      setResolveId(null);
      setResolution("FULL_REFUND");
      setRefundAmount("");
      setNotes("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to resolve dispute");
    } finally {
      setResolving(false);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Dispute Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review, investigate, and resolve customer disputes
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Open</p>
          <p className="mt-1 text-2xl font-bold text-red-600">{openCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">
            {inProgressCount}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {resolvedCount}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          {TICKET_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {disputes.data
            ? `${disputes.data.items.length} disputes`
            : "Loading..."}
        </span>
      </div>

      {/* Disputes Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Ticket Ref
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Order
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Reason
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Order Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Amount (AED)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {disputes.isLoading && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading disputes...
                </td>
              </tr>
            )}
            {disputes.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No disputes found
                </td>
              </tr>
            )}
            {disputes.data?.items.map((dispute) => (
              <tr key={dispute.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {dispute.ticketRef.slice(0, 8)}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {dispute.order?.orderRef
                    ? dispute.order.orderRef.slice(0, 8)
                    : "N/A"}
                </td>
                <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-500">
                  {dispute.subject}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <StatusBadge status={dispute.status as string} />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  {dispute.order ? (
                    <OrderStatusBadge status={dispute.order.status as string} />
                  ) : (
                    "N/A"
                  )}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {dispute.order
                    ? (dispute.order.totalFils / 100).toLocaleString("en-AE", {
                        minimumFractionDigits: 2,
                      })
                    : "--"}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {new Date(dispute.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  {dispute.status !== "RESOLVED" &&
                  dispute.status !== "CLOSED" ? (
                    <button
                      onClick={() => setResolveId(dispute.id)}
                      className="rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Resolve
                    </button>
                  ) : (
                    <span className="text-xs text-gray-400">Resolved</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resolution Modal */}
      {resolveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Resolve Dispute
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Resolution Type
                </label>
                <select
                  value={resolution}
                  onChange={(e) =>
                    setResolution(e.target.value as ResolutionType)
                  }
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  {RESOLUTION_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              {resolution === "PARTIAL_REFUND" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Refund Amount (AED)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={refundAmount}
                    onChange={(e) => setRefundAmount(e.target.value)}
                    placeholder="0.00"
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Notes
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Optional resolution notes..."
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setResolveId(null);
                  setResolution("FULL_REFUND");
                  setRefundAmount("");
                  setNotes("");
                }}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleResolve(resolveId)}
                disabled={
                  resolving ||
                  (resolution === "PARTIAL_REFUND" && !refundAmount)
                }
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {resolving ? "Processing..." : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
