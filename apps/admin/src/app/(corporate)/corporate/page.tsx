"use client";

import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

export default function CorporateDashboardPage() {
  const trpc = useTRPC();

  const accounts = useQuery(
    trpc.admin.listCorporateAccounts.queryOptions({ limit: 50 }),
  );
  const agents = useQuery(
    trpc.admin.listAgentPartners.queryOptions({ limit: 50 }),
  );

  const activeAccounts =
    accounts.data?.items.filter((a) => a.isActive).length ?? 0;
  const totalEmployees =
    accounts.data?.items.reduce((sum, a) => sum + a._count.employees, 0) ?? 0;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Corporate Accounts
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage B2B corporate accounts, employee access, and discounts
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Active Accounts</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {accounts.data ? activeAccounts : "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Total Employees</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {accounts.data ? totalEmployees : "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Agent Partners</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {agents.data ? agents.data.items.length : "--"}
          </p>
        </div>
      </div>

      {/* Accounts Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Company
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Contact
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Employees
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Discount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {accounts.isLoading && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading accounts...
                </td>
              </tr>
            )}
            {accounts.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No corporate accounts yet
                </td>
              </tr>
            )}
            {accounts.data?.items.map((a) => (
              <tr key={a.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">
                  {a.companyName}
                </td>
                <td className="px-6 py-4">
                  <p className="text-sm text-gray-900">{a.contactEmail}</p>
                  {a.contactPhone && (
                    <p className="text-xs text-gray-500">{a.contactPhone}</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {a._count.employees} / {a.maxEmployees}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {(a.discountBps / 100).toFixed(2)}%
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${a.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                  >
                    {a.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Agent Partners Section */}
      <div className="mt-8">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Agent Partners
        </h2>
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Agent
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Commission Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Total Referrals
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Earnings (AED)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {agents.isLoading && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-gray-400"
                  >
                    Loading agents...
                  </td>
                </tr>
              )}
              {agents.data?.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-sm text-gray-400"
                  >
                    No agent partners registered yet
                  </td>
                </tr>
              )}
              {agents.data?.items.map((agent) => (
                <tr key={agent.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {agent.companyName ?? "Individual Agent"}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {(agent.commissionRate / 100).toFixed(2)}%
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                    {agent.totalReferrals}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-900">
                    {(agent.totalEarningsFils / 100).toLocaleString("en-AE", {
                      minimumFractionDigits: 2,
                    })}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${agent.status === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}
                    >
                      {agent.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
