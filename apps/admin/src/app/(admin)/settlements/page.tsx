"use client";

import { useState } from "react";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    PROCESSING: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    FAILED: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

type SettlementStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export default function SettlementsPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedRetailerId, setSelectedRetailerId] = useState("");
  const [initiating, setInitiating] = useState(false);

  // Update status form
  const [updateSettlementId, setUpdateSettlementId] = useState("");
  const [updateStatus, setUpdateStatus] = useState<string>("");
  const [updateTransactionRef, setUpdateTransactionRef] = useState("");
  const [updating, setUpdating] = useState(false);

  // Fetch retailers for the initiate form
  const retailers = useQuery(
    trpc.admin.listRetailers.queryOptions({
      limit: 100,
      status: "APPROVED",
    }),
  );

  // Fetch all settlements
  const settlements = useQuery(
    trpc.admin.listAllSettlements.queryOptions({
      limit: 50,
      ...(statusFilter
        ? { status: statusFilter as SettlementStatus }
        : {}),
    }),
  );

  async function handleInitiateSettlement() {
    if (!selectedRetailerId) return;
    setInitiating(true);
    try {
      const result = await client.admin.initiateSettlement.mutate({
        retailerId: selectedRetailerId,
      });
      alert(
        `Settlement created: ${result.commissionCount} commissions, AED ${(result.totalAmountFils / 100).toFixed(2)}`,
      );
      setSelectedRetailerId("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to initiate settlement",
      );
    } finally {
      setInitiating(false);
    }
  }

  async function handleUpdateStatus() {
    if (!updateSettlementId || !updateStatus) return;
    setUpdating(true);
    try {
      await client.admin.updateSettlementStatus.mutate({
        settlementId: updateSettlementId,
        status: updateStatus as "PROCESSING" | "COMPLETED" | "FAILED",
        ...(updateTransactionRef
          ? { transactionRef: updateTransactionRef }
          : {}),
      });
      alert("Settlement status updated");
      setUpdateSettlementId("");
      setUpdateStatus("");
      setUpdateTransactionRef("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Failed to update settlement",
      );
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">
          Settlement Management
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Initiate payouts, track settlement status, and manage retailer
          payments
        </p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Initiate Settlement */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Initiate Settlement
          </h2>
          <p className="mb-4 text-sm text-gray-500">
            Bundle all cleared commissions for a retailer into a settlement
            payout.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Select Retailer
              </label>
              <select
                value={selectedRetailerId}
                onChange={(e) => setSelectedRetailerId(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Choose a retailer...</option>
                {retailers.data?.items.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.companyName}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleInitiateSettlement}
              disabled={initiating || !selectedRetailerId}
              className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {initiating ? "Processing..." : "Initiate Settlement"}
            </button>
          </div>
        </div>

        {/* Update Settlement Status */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Update Settlement Status
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Settlement
              </label>
              <select
                value={updateSettlementId}
                onChange={(e) => setUpdateSettlementId(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select a settlement...</option>
                {settlements.data?.items
                  .filter((s) => s.status !== "COMPLETED")
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.retailer.companyName} - AED{" "}
                      {(s.totalAmountFils / 100).toFixed(2)} ({s.status})
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                New Status
              </label>
              <select
                value={updateStatus}
                onChange={(e) => setUpdateStatus(e.target.value)}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Select status...</option>
                <option value="PROCESSING">Processing</option>
                <option value="COMPLETED">Completed</option>
                <option value="FAILED">Failed</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Transaction Reference (optional)
              </label>
              <input
                type="text"
                value={updateTransactionRef}
                onChange={(e) => setUpdateTransactionRef(e.target.value)}
                placeholder="e.g. TXN-2026-001234"
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <button
              onClick={handleUpdateStatus}
              disabled={updating || !updateSettlementId || !updateStatus}
              className="w-full rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50"
            >
              {updating ? "Updating..." : "Update Status"}
            </button>
          </div>
        </div>
      </div>

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="PROCESSING">Processing</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
        <span className="text-sm text-gray-500">
          {settlements.data
            ? `${settlements.data.items.length} settlements`
            : "Loading..."}
        </span>
      </div>

      {/* Settlements Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Retailer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Commissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Amount (AED)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Transaction Ref
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Payout Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {settlements.isLoading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading settlements...
                </td>
              </tr>
            )}
            {settlements.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No settlements found
                </td>
              </tr>
            )}
            {settlements.data?.items.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {s.retailer.companyName}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <StatusBadge status={s.status} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {s.commissionCount}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                  {(s.totalAmountFils / 100).toLocaleString("en-AE", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {s.transactionRef ?? "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {s.payoutDate
                    ? new Date(s.payoutDate).toLocaleDateString()
                    : "-"}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(s.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
