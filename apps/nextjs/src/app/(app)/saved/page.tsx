"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

interface SavedPackage {
  id: string;
  status: string;
  totalPriceFils: number;
  createdAt: Date;
  _count: { items: number };
}

export default function SavedPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<SavedPackage[]>([]);

  useEffect(() => {
    // Fetch all user's accepted packages across projects
    void client.package.list
      .query({ limit: 50 })
      .then((data) => {
        const accepted = (data.items as SavedPackage[]).filter(
          (p) => p.status === "ACCEPTED" || p.status === "READY",
        );
        setPackages(accepted);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading saved items...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Saved Packages</h1>
        <p className="text-muted-foreground mt-1">
          Your accepted and saved furnishing packages
        </p>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No saved packages yet. Generate packages from your projects to save
            them here.
          </p>
          <Button onClick={() => router.push("/projects")}>
            Go to Projects
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-lg border p-6">
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${pkg.status === "ACCEPTED" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}
                >
                  {pkg.status}
                </span>
                <span className="text-muted-foreground text-xs">
                  {new Date(pkg.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-lg font-semibold">
                AED {(pkg.totalPriceFils / 100).toFixed(2)}
              </p>
              <p className="text-muted-foreground text-sm">
                {pkg._count.items} items
              </p>
              <Button
                size="sm"
                className="mt-3"
                onClick={() => router.push("/cart")}
              >
                Add to Cart
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
