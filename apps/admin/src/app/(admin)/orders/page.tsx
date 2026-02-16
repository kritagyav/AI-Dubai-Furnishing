"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { useTRPC } from "~/trpc/react";

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    PENDING_PAYMENT: "bg-yellow-100 text-yellow-800",
    PAID: "bg-blue-100 text-blue-800",
    PROCESSING: "bg-indigo-100 text-indigo-800",
    SHIPPED: "bg-purple-100 text-purple-800",
    DELIVERED: "bg-green-100 text-green-800",
    CANCELLED: "bg-red-100 text-red-800",
    REFUNDED: "bg-orange-100 text-orange-800",
    DISPUTED: "bg-amber-100 text-amber-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-800"}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

const ORDER_STATUSES = [
  "",
  "PENDING_PAYMENT",
  "PAID",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
  "REFUNDED",
  "DISPUTED",
] as const;

export default function OrdersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");
  const trpc = useTRPC();

  type OrderStatus =
    | "DRAFT"
    | "PENDING_PAYMENT"
    | "PAID"
    | "PROCESSING"
    | "SHIPPED"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED"
    | "DISPUTED";

  const orders = useQuery(
    trpc.admin.listAllOrders.queryOptions({
      limit: 50,
      ...(statusFilter ? { status: statusFilter as OrderStatus } : {}),
    }),
  );

  const stats = useQuery(trpc.admin.platformStats.queryOptions());

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Order Management</h1>
          <p className="mt-1 text-sm text-gray-500">
            View, track, and manage all customer orders
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Total Revenue</p>
          <p className="text-lg font-bold text-gray-900">
            AED{" "}
            {stats.data
              ? (stats.data.orders.revenueFils / 100).toLocaleString("en-AE", {
                  minimumFractionDigits: 2,
                })
              : "--"}
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
          {ORDER_STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <span className="text-sm text-gray-500">
          {orders.data ? `${orders.data.items.length} orders` : "Loading..."}
        </span>
      </div>

      {/* Orders Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Order Ref
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Items
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Total (AED)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                Date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading orders...
                </td>
              </tr>
            )}
            {orders.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No orders found
                </td>
              </tr>
            )}
            {orders.data?.items.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium whitespace-nowrap text-gray-900">
                  {order.orderRef}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap">
                  <StatusBadge status={order.status as string} />
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {order._count.lineItems}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
                  {(order.totalFils / 100).toLocaleString("en-AE", {
                    minimumFractionDigits: 2,
                  })}
                </td>
                <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                  {new Date(order.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
