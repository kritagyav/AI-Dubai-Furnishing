"use client";

import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@dubai/ui/button";
import { SkeletonScreen, EmptyState } from "@dubai/ui";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPC, useTRPCClient } from "~/trpc/react";

type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_ON_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

type TicketCategory =
  | "ORDER_ISSUE"
  | "DELIVERY_ISSUE"
  | "PRODUCT_QUALITY"
  | "PAYMENT_ISSUE"
  | "ACCOUNT_ISSUE"
  | "GENERAL_INQUIRY"
  | "RETURN_REQUEST"
  | "DISPUTE"
  | "OTHER";

interface Attachment {
  key: string;
  filename: string;
  contentType: string;
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "ORDER_ISSUE", label: "Order Issue" },
  { value: "DELIVERY_ISSUE", label: "Delivery Issue" },
  { value: "PRODUCT_QUALITY", label: "Product Quality" },
  { value: "PAYMENT_ISSUE", label: "Payment Issue" },
  { value: "ACCOUNT_ISSUE", label: "Account Issue" },
  { value: "GENERAL_INQUIRY", label: "General Inquiry" },
  { value: "RETURN_REQUEST", label: "Return Request" },
  { value: "DISPUTE", label: "Dispute" },
  { value: "OTHER", label: "Other" },
];

async function uploadFile(
  client: ReturnType<typeof useTRPCClient>,
  file: File,
): Promise<Attachment> {
  const { uploadUrl, key } = await client.storage.getUploadUrl.mutate({
    purpose: "ticket_attachment",
    filename: file.name,
    contentType: file.type,
  });

  await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return { key, filename: file.name, contentType: file.type };
}

export default function SupportPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const queryClient = useQueryClient();

  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  // Create ticket form
  const [category, setCategory] = useState<TicketCategory>("GENERAL_INQUIRY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [createFiles, setCreateFiles] = useState<File[]>([]);
  const createFileRef = useRef<HTMLInputElement>(null);

  // Message form
  const [messageBody, setMessageBody] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);
  const [messageFiles, setMessageFiles] = useState<File[]>([]);
  const messageFileRef = useRef<HTMLInputElement>(null);

  const tickets = useQuery(
    trpc.support.listMine.queryOptions({
      limit: 50,
    }),
  );

  const ticketDetail = useQuery(
    trpc.support.get.queryOptions(
      { ticketId: selectedTicketId! },
      { enabled: !!selectedTicketId },
    ),
  );

  async function handleCreateTicket() {
    setCreating(true);
    try {
      let attachments: Attachment[] | undefined;
      if (createFiles.length > 0) {
        attachments = await Promise.all(
          createFiles.map((f) => uploadFile(client, f)),
        );
      }

      await client.support.create.mutate({
        category,
        subject,
        description,
        ...(attachments ? { attachments } : {}),
      });

      setSubject("");
      setDescription("");
      setCreateFiles([]);
      setView("list");
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create ticket");
    } finally {
      setCreating(false);
    }
  }

  async function handleSendMessage() {
    if (!selectedTicketId || !messageBody.trim()) return;
    setSendingMessage(true);
    try {
      let attachments: Attachment[] | undefined;
      if (messageFiles.length > 0) {
        attachments = await Promise.all(
          messageFiles.map((f) => uploadFile(client, f)),
        );
      }

      await client.support.addMessage.mutate({
        ticketId: selectedTicketId,
        body: messageBody,
        ...(attachments ? { attachments } : {}),
      });

      setMessageBody("");
      setMessageFiles([]);
      void queryClient.invalidateQueries();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setSendingMessage(false);
    }
  }

  function handleCreateFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setCreateFiles(Array.from(e.target.files).slice(0, 5));
    }
  }

  function handleMessageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) {
      setMessageFiles(Array.from(e.target.files).slice(0, 5));
    }
  }

  // ──── Detail View ────
  if (view === "detail" && selectedTicketId) {
    const ticket = ticketDetail.data;

    return (
      <div className="space-y-6">
        <button
          onClick={() => {
            setView("list");
            setSelectedTicketId(null);
          }}
          className="text-muted-foreground hover:text-foreground text-sm transition"
        >
          &larr; Back to Tickets
        </button>

        {ticketDetail.isLoading && (
          <SkeletonScreen rows={4} header />
        )}

        {ticket && (
          <>
            <div className="bg-card rounded-lg p-6 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <h1 className="text-2xl font-bold">{ticket.subject}</h1>
                  <p className="text-muted-foreground mt-1 text-sm">
                    {ticket.ticketRef} &middot;{" "}
                    {ticket.category.replace(/_/g, " ")}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
              <p className="mt-4 text-sm">{ticket.description}</p>

              {/* Ticket-level attachments */}
              {ticket.attachments &&
                Array.isArray(ticket.attachments) &&
                (ticket.attachments as Attachment[]).length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium">Attachments:</p>
                    <ul className="mt-1 space-y-1">
                      {(ticket.attachments as Attachment[]).map(
                        (att, i) => (
                          <li
                            key={i}
                            className="text-primary text-sm"
                          >
                            {att.filename} ({att.contentType})
                          </li>
                        ),
                      )}
                    </ul>
                  </div>
                )}

              <p className="text-muted-foreground mt-2 text-xs">
                Created{" "}
                {new Date(ticket.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Messages */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Messages</h2>
              {ticket.messages.length === 0 && (
                <p className="text-muted-foreground text-sm">
                  No messages yet.
                </p>
              )}
              {ticket.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`bg-card rounded-lg p-4 shadow-xs ${
                    msg.senderRole === "customer" ? "bg-accent/50" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase">
                      {msg.senderRole === "customer" ? "You" : "Support"}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {new Date(msg.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="mt-2 text-sm">{msg.body}</p>

                  {/* Message attachments */}
                  {msg.attachments &&
                    Array.isArray(msg.attachments) &&
                    (msg.attachments as Attachment[]).length > 0 && (
                      <div className="mt-2">
                        <p className="text-xs font-medium">Attachments:</p>
                        <ul className="mt-1 space-y-1">
                          {(msg.attachments as Attachment[]).map(
                            (att, i) => (
                              <li
                                key={i}
                                className="text-primary text-xs"
                              >
                                {att.filename} ({att.contentType})
                              </li>
                            ),
                          )}
                        </ul>
                      </div>
                    )}
                </div>
              ))}
            </div>

            {/* Reply form */}
            {ticket.status !== "CLOSED" && (
              <div className="bg-card space-y-3 rounded-lg p-4 shadow-xs">
                <h3 className="text-sm font-semibold">Send a Reply</h3>
                <textarea
                  value={messageBody}
                  onChange={(e) => setMessageBody(e.target.value)}
                  placeholder="Type your message..."
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  rows={3}
                />
                <div className="flex items-center gap-3">
                  <input
                    ref={messageFileRef}
                    type="file"
                    multiple
                    onChange={handleMessageFileChange}
                    className="text-sm"
                  />
                  {messageFiles.length > 0 && (
                    <span className="text-muted-foreground text-xs">
                      {messageFiles.length} file(s) selected
                    </span>
                  )}
                </div>
                <Button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !messageBody.trim()}
                >
                  {sendingMessage ? "Sending..." : "Send Message"}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ──── Create Ticket View ────
  if (view === "create") {
    return (
      <div className="space-y-6">
        <button
          onClick={() => setView("list")}
          className="text-muted-foreground hover:text-foreground text-sm transition"
        >
          &larr; Back to Tickets
        </button>

        <h1 className="text-2xl font-bold">Create Support Ticket</h1>

        <div className="bg-card space-y-4 rounded-lg p-6 shadow-xs">
          <div>
            <label className="text-sm font-medium">Category</label>
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as TicketCategory)
              }
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of your issue"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your issue in detail..."
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={5}
            />
          </div>

          <div>
            <label className="text-sm font-medium">
              Attachments (optional)
            </label>
            <input
              ref={createFileRef}
              type="file"
              multiple
              onChange={handleCreateFileChange}
              className="mt-1 text-sm"
            />
            {createFiles.length > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                {createFiles.length} file(s) selected (max 5)
              </p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleCreateTicket}
            disabled={creating || !subject.trim() || !description.trim()}
          >
            {creating ? "Creating..." : "Submit Ticket"}
          </Button>
        </div>
      </div>
    );
  }

  // ──── List View ────
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Support</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            View your tickets or create a new one.
          </p>
        </div>
        <Button onClick={() => setView("create")}>New Ticket</Button>
      </div>

      {tickets.isLoading && (
        <SkeletonScreen rows={3} />
      )}

      {tickets.data?.items.length === 0 && (
        <EmptyState
          title="No tickets yet"
          description="Create a ticket if you need help."
          actionLabel="New Ticket"
          onAction={() => setView("create")}
        />
      )}

      {tickets.data && tickets.data.items.length > 0 && (
        <div className="space-y-3">
          {tickets.data.items.map((ticket) => (
            <button
              key={ticket.id}
              onClick={() => {
                setSelectedTicketId(ticket.id);
                setView("detail");
              }}
              className="bg-card w-full rounded-lg p-4 shadow-xs text-left transition hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{ticket.subject}</h3>
                  <p className="text-muted-foreground text-xs">
                    {ticket.ticketRef} &middot;{" "}
                    {ticket.category.replace(/_/g, " ")} &middot;{" "}
                    {new Date(ticket.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={ticket.status} />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
