"use client";

/**
 * Retailer Dashboard — Stories 5.1/5.2.
 * Shows application status or (if approved) product stats and catalog link.
 */

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@dubai/ui/button";
import { Spinner } from "@dubai/ui";

import { StatCard } from "~/components/StatCard";
import { useTRPCClient } from "~/trpc/react";

export default function RetailerDashboardPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [status, setStatus] = useState<{
    hasApplication: boolean;
    status?: string;
    companyName?: string;
    rejectionReason?: string | null;
  } | null>(null);
  const [dashboard, setDashboard] = useState<{
    companyName: string;
    commissionRate: number;
    productStats: { total: number; active: number; pending: number; rejected: number };
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const appStatus = await client.retailer.getApplicationStatus.query();
        setStatus(appStatus);

        if (appStatus.hasApplication && appStatus.status === "APPROVED") {
          try {
            const dash = await client.retailer.getDashboard.query();
            setDashboard(dash);
          } catch {
            // May fail if tenant middleware rejects — that's OK
          }
        }
      } catch {
        // Not a retailer
      } finally {
        setLoading(false);
      }
    })();
  }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
      </div>
    );
  }

  // No application
  if (!status?.hasApplication) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <h1 className="text-3xl font-bold">Retailer Portal</h1>
        <p className="text-muted-foreground">
          Join the Dubai Furnishing Marketplace and reach customers
          furnishing apartments across Dubai.
        </p>
        <Button onClick={() => router.push("/retailer/register")}>
          Apply Now
        </Button>
      </div>
    );
  }

  // Pending application
  if (status.status === "PENDING") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <h1 className="text-3xl font-bold">Application Under Review</h1>
        <p className="text-muted-foreground">
          Your application for <strong>{status.companyName}</strong> is being
          reviewed. You'll receive a notification when a decision is made.
        </p>
        <div className="bg-muted rounded-lg p-4">
          <p className="text-sm">Expected review time: 1-3 business days</p>
        </div>
      </div>
    );
  }

  // Rejected
  if (status.status === "REJECTED") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <h1 className="text-3xl font-bold">Application Declined</h1>
        <p className="text-muted-foreground">
          Unfortunately, your application was not approved at this time.
        </p>
        {status.rejectionReason && (
          <div className="bg-muted rounded-lg p-4 text-left">
            <p className="text-sm font-medium">Reason:</p>
            <p className="text-muted-foreground text-sm">{status.rejectionReason}</p>
          </div>
        )}
      </div>
    );
  }

  // Approved — show dashboard
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">
          {dashboard?.companyName ?? "Retailer Dashboard"}
        </h1>
        <p className="text-muted-foreground mt-1">
          Commission rate: {((dashboard?.commissionRate ?? 0) / 100).toFixed(2)}%
        </p>
      </div>

      {dashboard && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Products" value={dashboard.productStats.total} />
          <StatCard label="Active" value={dashboard.productStats.active} />
          <StatCard label="Pending Review" value={dashboard.productStats.pending} />
          <StatCard label="Rejected" value={dashboard.productStats.rejected} />
        </div>
      )}

      <div className="flex gap-3">
        <Button onClick={() => router.push("/retailer/catalog")}>
          Manage Catalog
        </Button>
      </div>
    </div>
  );
}
