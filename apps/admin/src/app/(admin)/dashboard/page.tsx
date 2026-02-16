"use client";

import { useState } from "react";
import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

type Period = "7d" | "30d" | "90d";

function StatCard({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href?: string;
}) {
  const inner = (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RevenueKPICard({
  label,
  valueFils,
  prevFils,
  isCurrency,
}: {
  label: string;
  valueFils: number;
  prevFils?: number | undefined;
  isCurrency: boolean;
}) {
  const displayValue = isCurrency
    ? (valueFils / 100).toLocaleString("en-AE", {
        minimumFractionDigits: 2,
      })
    : valueFils.toLocaleString("en-AE");

  let changePercent: number | null = null;
  if (prevFils !== undefined && prevFils > 0) {
    changePercent = Math.round(((valueFils - prevFils) / prevFils) * 100);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900">
        {isCurrency ? `AED ${displayValue}` : displayValue}
      </p>
      {changePercent !== null && (
        <p
          className={`mt-1 text-sm font-medium ${
            changePercent >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {changePercent >= 0 ? "+" : ""}
          {changePercent}% vs prev period
        </p>
      )}
    </div>
  );
}

function DailyRevenueChart({
  data,
}: {
  data: Array<{ date: string; revenueFils: number }>;
}) {
  const maxRevenue = Math.max(...data.map((d) => d.revenueFils), 1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        Daily Revenue
      </h2>
      <div className="flex items-end gap-1" style={{ height: "120px" }}>
        {data.map((d) => {
          const heightPct = Math.max(
            (d.revenueFils / maxRevenue) * 100,
            2,
          );
          return (
            <div
              key={d.date}
              className="group relative flex-1"
              style={{ height: "100%" }}
            >
              <div
                className="absolute bottom-0 w-full rounded-t bg-blue-500 transition-colors hover:bg-blue-600"
                style={{ height: `${heightPct}%` }}
                title={`${d.date}: AED ${(d.revenueFils / 100).toLocaleString("en-AE", { minimumFractionDigits: 2 })}`}
              />
            </div>
          );
        })}
      </div>
      {data.length > 0 && (
        <div className="mt-2 flex justify-between text-xs text-gray-400">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  const trpc = useTRPC();
  const [period, setPeriod] = useState<Period>("30d");

  const stats = useQuery(trpc.admin.platformStats.queryOptions());
  const pending = useQuery(
    trpc.admin.listPendingRetailers.queryOptions({ limit: 5 }),
  );
  const supportMetrics = useQuery(trpc.support.metrics.queryOptions());
  const health = useQuery(trpc.admin.platformHealth.queryOptions());
  const revenue = useQuery(
    trpc.admin.revenueMetrics.queryOptions({ period }),
  );
  const disputes = useQuery(trpc.admin.disputeMetrics.queryOptions());

  const s = stats.data;
  const r = revenue.data;
  const d = disputes.data;
  const openTickets =
    (supportMetrics.data?.statuses.open ?? 0) +
    (supportMetrics.data?.statuses.inProgress ?? 0);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          Platform Dashboard
        </h1>
        {/* Period Selector */}
        <div className="flex gap-1 rounded-lg border border-gray-200 bg-white p-1">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                period === p
                  ? "bg-blue-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {p === "7d" ? "7 Days" : p === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* Revenue KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RevenueKPICard
          label="Total Revenue"
          valueFils={r?.revenueFils ?? 0}
          prevFils={r?.prevRevenueFils}
          isCurrency={true}
        />
        <RevenueKPICard
          label="Commissions"
          valueFils={r?.commissionsFils ?? 0}
          prevFils={r?.prevCommissionsFils}
          isCurrency={true}
        />
        <RevenueKPICard
          label="Net Payout"
          valueFils={r?.netPayoutFils ?? 0}
          isCurrency={true}
        />
        <RevenueKPICard
          label="Avg Order Value"
          valueFils={r?.averageOrderFils ?? 0}
          isCurrency={true}
        />
      </div>

      {/* Existing KPI Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Orders"
          value={s ? String(s.orders.total) : "--"}
          href="/orders"
        />
        <StatCard
          label="Revenue (AED)"
          value={
            s
              ? (s.orders.revenueFils / 100).toLocaleString("en-AE", {
                  minimumFractionDigits: 2,
                })
              : "--"
          }
        />
        <StatCard
          label="Active Retailers"
          value={s ? String(s.retailers.approved) : "--"}
          href="/retailer"
        />
        <StatCard
          label="Open Tickets"
          value={supportMetrics.data ? String(openTickets) : "--"}
          href="/support"
        />
      </div>

      {/* Daily Revenue Chart + Top Retailers */}
      <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Daily Revenue Chart */}
        {r?.dailyRevenue ? (
          <DailyRevenueChart data={r.dailyRevenue} />
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Daily Revenue
            </h2>
            <p className="py-8 text-center text-sm text-gray-400">
              Loading...
            </p>
          </div>
        )}

        {/* Top Retailers */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Top Retailers by Revenue
          </h2>
          {r?.topRetailers && r.topRetailers.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="pb-2 font-medium">Retailer</th>
                  <th className="pb-2 text-right font-medium">Revenue (AED)</th>
                  <th className="pb-2 text-right font-medium">Orders</th>
                </tr>
              </thead>
              <tbody>
                {r.topRetailers.map((retailer) => (
                  <tr
                    key={retailer.retailerId}
                    className="border-b border-gray-50 last:border-0"
                  >
                    <td className="py-2 font-medium text-gray-900">
                      {retailer.companyName}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {(retailer.revenueFils / 100).toLocaleString("en-AE", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="py-2 text-right text-gray-700">
                      {retailer.orderCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="py-8 text-center text-sm text-gray-400">
              {r ? "No retailer data for this period" : "Loading..."}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Dispute Summary */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Dispute Summary
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Disputes</span>
              <span className="font-medium text-gray-900">
                {d ? d.totalDisputes : "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Resolved</span>
              <span className="font-medium text-green-600">
                {d ? d.resolved : "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Pending</span>
              <span className="font-medium text-yellow-600">
                {d ? d.pending : "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg Resolution Time</span>
              <span className="font-medium text-gray-900">
                {d ? `${d.avgResolutionHours}h` : "--"}
              </span>
            </div>
            {d && Object.keys(d.byReason).length > 0 && (
              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="mb-2 text-xs font-medium uppercase text-gray-500">
                  By Category
                </p>
                {Object.entries(d.byReason).map(([reason, count]) => (
                  <div
                    key={reason}
                    className="flex justify-between text-sm"
                  >
                    <span className="text-gray-600">
                      {reason.replace(/_/g, " ")}
                    </span>
                    <span className="font-medium text-gray-900">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Pending Retailer Applications
          </h2>
          {pending.data?.items.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-400">
              No pending applications
            </p>
          )}
          <div className="space-y-3">
            {pending.data?.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {item.companyName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {item.contactEmail} &middot; {item.tradeLicenseNumber}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
          {(pending.data?.items.length ?? 0) > 0 && (
            <Link
              href="/retailer"
              className="mt-3 block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              View all retailers
            </Link>
          )}
        </div>

        {/* Support Metrics */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Support Overview
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Open</span>
              <span className="font-medium text-yellow-600">
                {supportMetrics.data?.statuses.open ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">In Progress</span>
              <span className="font-medium text-blue-600">
                {supportMetrics.data?.statuses.inProgress ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Waiting on Customer</span>
              <span className="font-medium text-purple-600">
                {supportMetrics.data?.statuses.waitingOnCustomer ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Resolved</span>
              <span className="font-medium text-green-600">
                {supportMetrics.data?.statuses.resolved ?? "--"}
              </span>
            </div>
          </div>
          <Link
            href="/support"
            className="mt-4 block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            Go to support center
          </Link>
        </div>

        {/* Platform Health */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Platform Health
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">API</span>
              <span className={`font-medium ${health.data ? "text-green-600" : "text-gray-400"}`}>
                {health.data?.api ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Database</span>
              <span className={`font-medium ${health.data ? "text-green-600" : "text-gray-400"}`}>
                {health.data?.database ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Worker</span>
              <span className={`font-medium ${health.data?.worker === "Running" ? "text-green-600" : health.data?.worker === "Idle" ? "text-yellow-600" : "text-gray-400"}`}>
                {health.data?.worker ?? "--"}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Orders (1h)</span>
              <span className="font-medium text-gray-900">
                {health.data?.recentOrders ?? "--"}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/retailer"
              className="rounded-md bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 hover:bg-blue-100"
            >
              Review Retailers
            </Link>
            <Link
              href="/deliveries"
              className="rounded-md bg-green-50 px-4 py-2 text-center text-sm font-medium text-green-700 hover:bg-green-100"
            >
              Manage Deliveries
            </Link>
            <Link
              href="/orders"
              className="rounded-md bg-purple-50 px-4 py-2 text-center text-sm font-medium text-purple-700 hover:bg-purple-100"
            >
              View Orders
            </Link>
            <Link
              href="/corporate"
              className="rounded-md bg-amber-50 px-4 py-2 text-center text-sm font-medium text-amber-700 hover:bg-amber-100"
            >
              Corporate Accounts
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
