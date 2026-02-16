"use client";

/**
 * Retailer Catalog — Story 5.2: Product Catalog API Integration.
 * Lists products with status filtering, links to upload.
 */
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, SkeletonScreen } from "@dubai/ui";
import { Button } from "@dubai/ui/button";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPCClient } from "~/trpc/react";

interface ProductItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  priceFils: number;
  stockQuantity: number;
  validationStatus: string;
  photos: unknown;
  updatedAt: Date;
}

export default function RetailerCatalogPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");

  const loadProducts = useCallback(async () => {
    try {
      const result = await client.catalog.listProducts.query({
        limit: 50,
        status: statusFilter
          ? (statusFilter as "ACTIVE" | "PENDING" | "REJECTED")
          : undefined,
      });
      setProducts(result.items);
    } catch {
      // Error handled by empty state
    } finally {
      setLoading(false);
    }
  }, [client, statusFilter]);

  useEffect(() => {
    setLoading(true);
    void loadProducts();
  }, [loadProducts]);

  async function handleDelete(productId: string) {
    if (!confirm("Delete this product?")) return;
    try {
      await client.catalog.deleteProduct.mutate({ productId });
      void loadProducts();
    } catch {
      // Swallow
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Product Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Manage your product inventory
          </p>
        </div>
        <Button onClick={() => router.push("/retailer/catalog/upload")}>
          Upload Products
        </Button>
      </div>

      {/* Status Filter */}
      <div className="flex gap-2">
        {["", "ACTIVE", "PENDING", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`min-h-[44px] rounded-md border px-4 py-2 text-sm ${
              statusFilter === status
                ? "border-foreground bg-foreground text-background"
                : "border-input hover:border-foreground/30"
            }`}
          >
            {status || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonScreen rows={4} />
      ) : products.length === 0 ? (
        <EmptyState
          title="No products found"
          description={
            statusFilter
              ? `No ${statusFilter.toLowerCase()} products. Try a different filter.`
              : "Upload your product catalog to get started."
          }
          actionLabel="Upload Products"
          onAction={() => router.push("/retailer/catalog/upload")}
        />
      ) : (
        <div className="border-border overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Product</th>
                <th className="px-4 py-3 text-left font-medium">SKU</th>
                <th className="px-4 py-3 text-left font-medium">Category</th>
                <th className="px-4 py-3 text-right font-medium">
                  Price (AED)
                </th>
                <th className="px-4 py-3 text-right font-medium">Stock</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border divide-y">
              {products.map((product) => (
                <tr key={product.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium">{product.name}</td>
                  <td className="text-muted-foreground px-4 py-3">
                    {product.sku}
                  </td>
                  <td className="text-muted-foreground px-4 py-3">
                    {product.category.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {(product.priceFils / 100).toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {product.stockQuantity}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={product.validationStatus} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(product.id)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
