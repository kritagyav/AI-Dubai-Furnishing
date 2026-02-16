"use client";

/**
 * Active Devices settings page — Story 1.9.
 * Lists all active sessions with device info and allows revoking them.
 */

import { useCallback, useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { SkeletonScreen, EmptyState } from "@dubai/ui";

import { useTRPCClient } from "~/trpc/react";

interface DeviceSession {
  id: string;
  deviceType: string | null;
  deviceName: string | null;
  lastActiveAt: Date;
  lastPath: string | null;
  createdAt: Date;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-AE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(date));
}

function DeviceIcon({ type }: { type: string | null }) {
  const label =
    type === "mobile" ? "Phone" : type === "tablet" ? "Tablet" : "Computer";

  return (
    <div
      className="bg-muted flex h-10 w-10 items-center justify-center rounded-full"
      aria-label={label}
    >
      <span className="text-lg">
        {type === "mobile" ? "\u{1F4F1}" : type === "tablet" ? "\u{1F4CB}" : "\u{1F4BB}"}
      </span>
    </div>
  );
}

export default function DevicesPage() {
  const client = useTRPCClient();
  const [sessions, setSessions] = useState<DeviceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      const data = await client.session.listDevices.query();
      setSessions(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void fetchSessions();
  }, [fetchSessions]);

  const handleRevoke = async (sessionId: string) => {
    setRevoking(sessionId);
    try {
      await client.session.revokeSession.mutate({ sessionId });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // silently fail
    } finally {
      setRevoking(null);
    }
  };

  const handleRevokeAll = async () => {
    if (sessions.length <= 1) return;

    const currentSessionId = sessions[0]?.id;
    if (!currentSessionId) return;

    setRevoking("all");
    try {
      await client.session.revokeAllOtherSessions.mutate({ currentSessionId });
      setSessions((prev) => (prev[0] ? [prev[0]] : []));
    } catch {
      // silently fail
    } finally {
      setRevoking(null);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Active Devices</h1>
        {sessions.length > 1 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={handleRevokeAll}
            disabled={revoking === "all"}
          >
            {revoking === "all" ? "Signing out..." : "Sign out everywhere else"}
          </Button>
        )}
      </div>

      <p className="text-muted-foreground text-sm">
        These are the devices currently signed into your account. If you see an
        unfamiliar device, revoke its access immediately.
      </p>

      {loading ? (
        <SkeletonScreen rows={3} />
      ) : sessions.length === 0 ? (
        <EmptyState
          title="No active sessions"
          description="No active sessions found."
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session, index) => (
            <div
              key={session.id}
              className="bg-card flex items-center justify-between rounded-lg p-4 shadow-xs"
            >
              <div className="flex items-center gap-4">
                <DeviceIcon type={session.deviceType} />
                <div>
                  <p className="text-foreground text-sm font-medium">
                    {session.deviceName ?? session.deviceType ?? "Unknown device"}
                    {index === 0 && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        (this device)
                      </span>
                    )}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    Last active: {formatDate(session.lastActiveAt)}
                    {session.lastPath && (
                      <span> &middot; {session.lastPath}</span>
                    )}
                  </p>
                </div>
              </div>
              {index > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleRevoke(session.id)}
                  disabled={revoking === session.id}
                >
                  {revoking === session.id ? "Revoking..." : "Revoke"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
