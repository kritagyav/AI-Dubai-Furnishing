"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { EmptyState, SkeletonScreen } from "@dubai/ui";
import { Button } from "@dubai/ui/button";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPC, useTRPCClient } from "~/trpc/react";

interface SavedPackage {
  id: string;
  status: string;
  totalPriceFils: number;
  createdAt: Date;
  _count: { items: number };
}

export default function SavedPage() {
  const trpc = useTRPC();
  const client = useTRPCClient();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<SavedPackage[]>([]);

  const addToCartMutation = useMutation(
    trpc.package.addPackageToCart.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries({
          queryKey: trpc.commerce.getCart.queryKey(),
        });
        router.push("/cart");
      },
    }),
  );

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
      <div className="py-20">
        <SkeletonScreen rows={3} />
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
        <EmptyState
          title="No saved packages"
          description="Generate packages from your projects to save them here."
          actionLabel="Go to Projects"
          onAction={() => router.push("/projects")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-card rounded-lg p-6 shadow-xs">
              <div className="mb-2 flex items-center justify-between">
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
              <Button
                size="sm"
                className="mt-3"
                disabled={addToCartMutation.isPending}
                onClick={() => addToCartMutation.mutate({ packageId: pkg.id })}
              >
                {addToCartMutation.isPending ? "Adding..." : "Add to Cart"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
