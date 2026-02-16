"use client";

import Link from "next/link";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

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

export default function AdminDashboardPage() {
  const trpc = useTRPC();
  const stats = useQuery(trpc.admin.platformStats.queryOptions());
  const pending = useQuery(
    trpc.admin.listPendingRetailers.queryOptions({ limit: 5 }),
  );
  const supportMetrics = useQuery(trpc.support.metrics.queryOptions());
  const health = useQuery(trpc.admin.platformHealth.queryOptions());

  const s = stats.data;
  const openTickets =
    (supportMetrics.data?.statuses.open ?? 0) +
    (supportMetrics.data?.statuses.inProgress ?? 0);

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">
        Platform Dashboard
      </h1>

      {/* KPI Cards */}
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
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
            {pending.data?.items.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between border-b border-gray-100 py-3 last:border-0"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {r.companyName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {r.contactEmail} &middot; {r.tradeLicenseNumber}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(r.createdAt).toLocaleDateString()}
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
