"use client";

import { useState } from "react";
import { useTRPC } from "~/trpc/react";
import { useQuery } from "@tanstack/react-query";

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-800",
    MEDIUM: "bg-blue-100 text-blue-800",
    HIGH: "bg-orange-100 text-orange-800",
    URGENT: "bg-red-100 text-red-800",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[priority] ?? "bg-gray-100 text-gray-800"}`}
    >
      {priority}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    OPEN: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    WAITING_ON_CUSTOMER: "bg-purple-100 text-purple-800",
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

export default function SupportDashboardPage() {
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");

  const metrics = useQuery(trpc.support.metrics.queryOptions());

  type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
  type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  const tickets = useQuery(
    trpc.support.listAll.queryOptions({
      limit: 50,
      ...(statusFilter ? { status: statusFilter as TicketStatus } : {}),
      ...(priorityFilter ? { priority: priorityFilter as TicketPriority } : {}),
    }),
  );

  const m = metrics.data;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support Center</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage tickets, assign agents, and track resolution metrics
          </p>
        </div>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Open</p>
          <p className="mt-1 text-2xl font-bold text-yellow-600">
            {m?.statuses.open ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">
            {m?.statuses.inProgress ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Waiting on Customer</p>
          <p className="mt-1 text-2xl font-bold text-purple-600">
            {m?.statuses.waitingOnCustomer ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Resolved</p>
          <p className="mt-1 text-2xl font-bold text-green-600">
            {m?.statuses.resolved ?? "--"}
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <p className="text-sm text-gray-500">Urgent</p>
          <p className="mt-1 text-2xl font-bold text-red-600">
            {m?.activePriorities.urgent ?? "--"}
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
          <option value="OPEN">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_ON_CUSTOMER">Waiting on Customer</option>
          <option value="RESOLVED">Resolved</option>
          <option value="CLOSED">Closed</option>
        </select>
        <select
          className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
          <option value="URGENT">Urgent</option>
        </select>
        <span className="text-sm text-gray-500">
          {tickets.data
            ? `${tickets.data.items.length} tickets`
            : "Loading..."}
        </span>
      </div>

      {/* Tickets Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Ref
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Subject
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Messages
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                Created
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {tickets.isLoading && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  Loading tickets...
                </td>
              </tr>
            )}
            {tickets.data?.items.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-6 py-12 text-center text-sm text-gray-400"
                >
                  No tickets found
                </td>
              </tr>
            )}
            {tickets.data?.items.map((ticket) => (
              <tr key={ticket.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                  {ticket.ticketRef}
                </td>
                <td className="max-w-xs truncate px-6 py-4 text-sm text-gray-900">
                  {ticket.subject}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {ticket.category.replace(/_/g, " ")}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <PriorityBadge priority={ticket.priority} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm">
                  <StatusBadge status={ticket.status} />
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {ticket._count.messages}
                </td>
                <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-500">
                  {new Date(ticket.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
