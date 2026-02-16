"use client";

import { useState } from "react";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

interface Attachment {
  key: string;
  filename: string;
  contentType: string;
}

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

function AttachmentList({ attachments }: { attachments: unknown }) {
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
    return null;
  }

  const items = attachments as Attachment[];

  return (
    <div className="mt-2">
      <p className="text-xs font-medium text-gray-600">Attachments:</p>
      <ul className="mt-1 space-y-1">
        {items.map((att, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className="inline-block rounded bg-gray-100 px-1.5 py-0.5 font-mono text-gray-600">
              {att.contentType}
            </span>
            <span className="text-blue-600 underline">
              {att.filename}
            </span>
            <span className="text-gray-400">(key: {att.key})</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function SupportDashboardPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Reply form
  const [replyBody, setReplyBody] = useState("");
  const [sendingReply, setSendingReply] = useState(false);

  type TicketStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CUSTOMER" | "RESOLVED" | "CLOSED";
  type TicketPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

  const metrics = useQuery(trpc.support.metrics.queryOptions());

  const tickets = useQuery(
    trpc.support.listAll.queryOptions({
      limit: 50,
      ...(statusFilter ? { status: statusFilter as TicketStatus } : {}),
      ...(priorityFilter ? { priority: priorityFilter as TicketPriority } : {}),
    }),
  );

  const ticketDetail = useQuery(
    trpc.support.getTicket.queryOptions(
      { ticketId: selectedTicketId! },
      { enabled: !!selectedTicketId },
    ),
  );

  async function handleSendReply() {
    if (!selectedTicketId || !replyBody.trim()) return;
    setSendingReply(true);
    try {
      await client.support.reply.mutate({
        ticketId: selectedTicketId,
        body: replyBody,
      });
      setReplyBody("");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send reply");
    } finally {
      setSendingReply(false);
    }
  }

  const m = metrics.data;

  // ──── Ticket Detail View ────
  if (selectedTicketId) {
    const ticket = ticketDetail.data;

    return (
      <div>
        <button
          onClick={() => setSelectedTicketId(null)}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700"
        >
          &larr; Back to Tickets
        </button>

        {ticketDetail.isLoading && (
          <p className="text-gray-400">Loading ticket...</p>
        )}

        {ticket && (
          <div className="space-y-6">
            {/* Ticket header */}
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {ticket.subject}
                  </h1>
                  <p className="mt-1 text-sm text-gray-500">
                    {ticket.ticketRef} &middot; User: {ticket.userId}
                    {ticket.assigneeId
                      ? ` &middot; Assigned: ${ticket.assigneeId}`
                      : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <PriorityBadge priority={ticket.priority} />
                  <StatusBadge status={ticket.status} />
                </div>
              </div>
              <p className="mt-4 text-sm text-gray-700">{ticket.description}</p>
              <AttachmentList attachments={ticket.attachments} />
              <p className="mt-3 text-xs text-gray-400">
                Created {new Date(ticket.createdAt).toLocaleString()}
              </p>
            </div>

            {/* Messages */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-900">Messages</h2>
              {ticket.messages.length === 0 && (
                <p className="text-sm text-gray-400">No messages yet.</p>
              )}
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`rounded-lg border p-4 ${
                    msg.senderRole === "support"
                      ? "border-blue-200 bg-blue-50"
                      : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase text-gray-600">
                      {msg.senderRole} ({msg.senderId})
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-800">{msg.body}</p>
                  <AttachmentList attachments={msg.attachments} />
                </div>
              ))}
            </div>

            {/* Reply form */}
            {ticket.status !== "CLOSED" && (
              <div className="rounded-lg border border-gray-200 bg-white p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-700">
                  Reply as Support
                </h3>
                <textarea
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder="Type your reply..."
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  rows={3}
                />
                <button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyBody.trim()}
                  className="mt-3 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {sendingReply ? "Sending..." : "Send Reply"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ──── List View ────
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
              <tr
                key={ticket.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedTicketId(ticket.id)}
              >
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
