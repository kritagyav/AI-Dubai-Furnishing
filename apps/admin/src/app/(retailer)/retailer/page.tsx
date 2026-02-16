"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useTRPC, useTRPCClient } from "~/trpc/react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    SUSPENDED: "bg-gray-100 text-gray-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status}
    </span>
  );
}

export default function RetailerDashboardPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("");

  const retailers = useQuery(
    trpc.admin.listRetailers.queryOptions({
      limit: 50,
      ...(statusFilter
        ? {
            status: statusFilter as
              | "PENDING"
              | "APPROVED"
              | "REJECTED"
              | "SUSPENDED",
          }
        : {}),
    }),
  );

  const pending = useQuery(
    trpc.admin.listPendingRetailers.queryOptions({ limit: 50 }),
  );

  async function handleDecision(
    retailerId: string,
    decision: "APPROVED" | "REJECTED",
  ) {
    try {
      await client.admin.decideRetailer.mutate({
        retailerId,
        decision,
        ...(decision === "REJECTED"
          ? { reason: "Does not meet platform requirements" }
          : {}),
      });
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Retailer Management
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Review applications, manage retailers, and monitor catalog health
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 flex items-center gap-3">
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="SUSPENDED">Suspended</option>
        </select>
        <span className="text-sm text-gray-500">
          {retailers.data
            ? `${retailers.data.items.length} retailers`
            : "Loading..."}
        </span>
      </div>

      {/* Retailer Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                License
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Products
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Joined
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {retailers.isLoading && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading retailers...
                </td>
              </tr>
            )}
            {retailers.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No retailers found
                </td>
              </tr>
            )}
            {retailers.data?.items.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <p className="text-sm font-medium text-gray-900">
                    {r.companyName}
                  </p>
                  <p className="text-xs text-gray-500">{r.contactEmail}</p>
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {r.tradeLicenseNumber}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <StatusBadge status={r.status as string} />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {r._count.products}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {(r.commissionRate / 100).toFixed(2)}%
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {new Date(r.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pending Applications Section */}
      {(pending.data?.items.length ?? 0) > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pending Applications ({pending.data?.items.length})
          </h2>
          <div className="space-y-4">
            {pending.data?.items.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-yellow-200 bg-yellow-50 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900">{r.companyName}</p>
                    <p className="text-sm text-gray-500">
                      {r.contactEmail} &middot; License: {r.tradeLicenseNumber}{" "}
                      &middot; {r.businessType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDecision(r.id, "APPROVED")}
                      className="rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(r.id, "REJECTED")}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
