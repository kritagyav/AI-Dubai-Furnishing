"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

interface PackageSummary {
  id: string;
  status: string;
  totalPriceFils: number;
  createdAt: Date;
  _count: { items: number };
}

const statusColors: Record<string, string> = {
  GENERATING: "bg-yellow-100 text-yellow-800",
  READY: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  EXPIRED: "bg-gray-100 text-gray-800",
};

export default function ProjectPackagesPage() {
  const params = useParams();
  const client = useTRPCClient();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [generating, setGenerating] = useState(false);

  function loadPackages() {
    void client.package.list
      .query({ projectId, limit: 20 })
      .then((data) => {
        setPackages(data.items as PackageSummary[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  useEffect(() => {
    loadPackages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    try {
      await client.package.generate.mutate({ projectId });
      // Reload packages to show the new one
      loadPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleAccept(packageId: string) {
    try {
      await client.package.updateStatus.mutate({
        packageId,
        status: "ACCEPTED",
      });
      loadPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleReject(packageId: string) {
    try {
      await client.package.updateStatus.mutate({
        packageId,
        status: "REJECTED",
      });
      loadPackages();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed");
    }
  }

  async function handleAddToCart(packageId: string) {
    try {
      const result = await client.package.addPackageToCart.mutate({ packageId });
      alert(`Added ${result.added} items to cart!`);
      router.push("/cart");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add to cart");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading packages...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push(`/projects/${projectId}`)}
            className="text-muted-foreground mb-1 text-sm hover:underline"
          >
            &larr; Back to project
          </button>
          <h1 className="text-3xl font-bold">AI Furnishing Packages</h1>
          <p className="text-muted-foreground mt-1">
            Generated furniture packages for your project
          </p>
        </div>
        <Button disabled={generating} onClick={handleGenerate}>
          {generating ? "Generating..." : "Generate New Package"}
        </Button>
      </div>

      {packages.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground mb-4">
            No packages yet. Generate your first AI-curated furnishing package!
          </p>
          <Button disabled={generating} onClick={handleGenerate}>
            {generating ? "Generating..." : "Generate Package"}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="rounded-lg border p-6">
              <div className="mb-3 flex items-center justify-between">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[pkg.status] ?? "bg-gray-100 text-gray-800"}`}
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

              <div className="mt-4 flex gap-2">
                {pkg.status === "READY" && (
                  <>
                    <Button size="sm" onClick={() => handleAccept(pkg.id)}>
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReject(pkg.id)}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {pkg.status === "ACCEPTED" && (
                  <Button size="sm" onClick={() => handleAddToCart(pkg.id)}>
                    Add to Cart
                  </Button>
                )}
                {pkg.status === "GENERATING" && (
                  <p className="text-muted-foreground text-xs">
                    Generating your package...
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
