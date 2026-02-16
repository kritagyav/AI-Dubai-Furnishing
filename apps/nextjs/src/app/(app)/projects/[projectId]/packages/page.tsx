"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";
import { SkeletonScreen, EmptyState, EngagingWait } from "@dubai/ui";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPCClient } from "~/trpc/react";

interface PackageSummary {
  id: string;
  status: string;
  totalPriceFils: number;
  createdAt: Date;
  _count: { items: number };
}

const GENERATION_STEPS = [
  "Analyzing room dimensions",
  "Matching your style",
  "Curating furniture selection",
  "Finalizing package",
];

export default function ProjectPackagesPage() {
  const params = useParams();
  const client = useTRPCClient();
  const router = useRouter();
  const projectId = params.projectId as string;

  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<PackageSummary[]>([]);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);

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

  // Progress simulation for engaging wait
  useEffect(() => {
    if (!generating) return;
    const interval = setInterval(() => {
      setGenStep((s) => (s < GENERATION_STEPS.length - 1 ? s + 1 : s));
    }, 3000);
    return () => clearInterval(interval);
  }, [generating]);

  async function handleGenerate() {
    setGenerating(true);
    setGenStep(0);
    try {
      await client.package.generate.mutate({ projectId });
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
    return <SkeletonScreen rows={3} message="Loading packages..." />;
  }

  if (generating) {
    return (
      <EngagingWait
        currentStep={genStep}
        totalSteps={GENERATION_STEPS.length}
        steps={GENERATION_STEPS}
        tips={[
          "Our AI analyzes thousands of furniture combinations to find the best fit.",
          "Packages are optimized for your room dimensions and style preferences.",
          "Each suggestion comes from verified Dubai retailers with quality guarantees.",
        ]}
        currentTip={genStep}
      />
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
        <EmptyState
          title="No packages yet"
          description="Generate your first AI-curated furnishing package!"
          actionLabel="Generate Package"
          onAction={handleGenerate}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card rounded-lg p-6 shadow-xs">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={pkg.status} />
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
