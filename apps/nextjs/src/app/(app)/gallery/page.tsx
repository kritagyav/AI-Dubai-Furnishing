"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { trackPageView } from "~/lib/analytics";
import { useTRPC } from "~/trpc/react";

const CATEGORIES = [
  { id: "all", label: "All Styles" },
  { id: "SOFA", label: "Sofas" },
  { id: "BED", label: "Beds" },
  { id: "DINING_TABLE", label: "Dining Tables" },
  { id: "DESK", label: "Desks" },
  { id: "WARDROBE", label: "Wardrobes" },
  { id: "BOOKSHELF", label: "Bookshelves" },
  { id: "LIGHTING", label: "Lighting" },
  { id: "RUG", label: "Rugs" },
  { id: "DECOR", label: "Decor" },
  { id: "OUTDOOR", label: "Outdoor" },
] as const;

export default function GalleryPage() {
  const router = useRouter();
  const trpc = useTRPC();

  useEffect(() => {
    trackPageView("Gallery Viewed");
  }, []);

  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "price_asc" | "price_desc">(
    "newest",
  );

  const products = useQuery(
    trpc.catalog.browseProducts.queryOptions({
      limit: 24,
      category: category === "all" ? undefined : category,
      search: search || undefined,
      sortBy: sort,
    }),
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Style Gallery</h1>
        <p className="text-muted-foreground mt-1">
          Browse curated furniture from top Dubai retailers. Find pieces you
          love, then start a project to furnish your space.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded-md border px-3 py-2 text-sm"
        />
        <select
          value={sort}
          onChange={(e) =>
            setSort(e.target.value as "newest" | "price_asc" | "price_desc")
          }
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="newest">Newest</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
              category === cat.id
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {products.isLoading && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse rounded-lg border">
              <div className="h-48 rounded-t-lg bg-gray-200" />
              <div className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-gray-200" />
                <div className="h-3 w-1/3 rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      )}

      {products.data && products.data.items.length === 0 && (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <p className="text-muted-foreground text-lg">
            No products found matching your criteria.
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Try adjusting your filters or search terms.
          </p>
        </div>
      )}

      {products.data && products.data.items.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {products.data.items.map((product) => {
            const photos = product.photos as string[] | null;
            const firstPhoto = photos?.[0];
            const materials = product.materials as string[] | null;

            return (
              <button
                key={product.id}
                onClick={() => router.push(`/gallery/${product.id}`)}
                className="group overflow-hidden rounded-lg border text-left transition hover:shadow-lg"
              >
                <div className="flex h-48 items-center justify-center bg-gray-100">
                  {firstPhoto ? (
                    <img
                      src={firstPhoto}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">
                      No image
                    </span>
                  )}
                </div>
                <div className="p-4">
                  <h3 className="truncate font-semibold">{product.name}</h3>
                  <p className="text-muted-foreground text-xs">
                    {product.retailer.companyName}
                  </p>
                  <div className="mt-1 flex items-baseline justify-between">
                    <span className="text-lg font-bold">
                      AED{" "}
                      {(product.priceFils / 100).toLocaleString("en-AE", {
                        minimumFractionDigits: 2,
                      })}
                    </span>
                    <span className="text-muted-foreground rounded bg-gray-100 px-2 py-0.5 text-xs">
                      {product.category.replace(/_/g, " ")}
                    </span>
                  </div>
                  {materials && materials.length > 0 && (
                    <p className="text-muted-foreground mt-1 truncate text-xs">
                      {materials.join(", ")}
                    </p>
                  )}
                  <span className="mt-3 block w-full rounded-md border px-3 py-2 text-center text-sm font-medium transition group-hover:bg-gray-50">
                    View Details
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
