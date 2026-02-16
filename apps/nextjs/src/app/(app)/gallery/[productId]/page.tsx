"use client";

/**
 * Product Detail Page — shows full product info, photos, retailer info,
 * and related products. Public access via catalog.getProductDetail.
 */

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@dubai/ui/button";

import { useTRPC, useTRPCClient } from "~/trpc/react";

const CATEGORY_LABELS: Record<string, string> = {
  SOFA: "Sofa",
  BED: "Bed",
  DINING_TABLE: "Dining Table",
  DINING_CHAIR: "Dining Chair",
  DESK: "Desk",
  OFFICE_CHAIR: "Office Chair",
  WARDROBE: "Wardrobe",
  DRESSER: "Dresser",
  BOOKSHELF: "Bookshelf",
  TV_UNIT: "TV Unit",
  COFFEE_TABLE: "Coffee Table",
  SIDE_TABLE: "Side Table",
  RUG: "Rug",
  CURTAIN: "Curtain",
  LIGHTING: "Lighting",
  MIRROR: "Mirror",
  STORAGE: "Storage",
  OUTDOOR: "Outdoor",
  DECOR: "Decor",
  OTHER: "Other",
};

export default function ProductDetailPage() {
  const params = useParams<{ productId: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const client = useTRPCClient();
  const [selectedPhoto, setSelectedPhoto] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [cartMessage, setCartMessage] = useState<string | null>(null);

  const product = useQuery(
    trpc.catalog.getProductDetail.queryOptions({
      productId: params.productId,
    }),
  );

  async function handleAddToCart() {
    if (!product.data) return;
    setAddingToCart(true);
    setCartMessage(null);
    try {
      await client.commerce.addToCart.mutate({
        productId: product.data.id,
        quantity: 1,
      });
      setCartMessage("Added to cart");
    } catch {
      setCartMessage("Failed to add to cart");
    } finally {
      setAddingToCart(false);
    }
  }

  // Loading skeleton
  if (product.isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-6 w-32 rounded bg-gray-200" />
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <div className="aspect-square rounded-lg bg-gray-200" />
            <div className="space-y-4">
              <div className="h-8 w-3/4 rounded bg-gray-200" />
              <div className="h-6 w-1/3 rounded bg-gray-200" />
              <div className="h-4 w-1/4 rounded bg-gray-200" />
              <div className="mt-6 h-20 rounded bg-gray-200" />
              <div className="flex gap-3">
                <div className="h-10 w-32 rounded bg-gray-200" />
                <div className="h-10 w-32 rounded bg-gray-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (product.error || !product.data) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-xl font-semibold">Product not found</h2>
        <p className="text-muted-foreground mt-2">
          This product may no longer be available.
        </p>
        <Button
          variant="outline"
          className="mt-4"
          onClick={() => router.push("/gallery")}
        >
          Back to Gallery
        </Button>
      </div>
    );
  }

  const data = product.data;
  const photos = (data.photos as string[] | null) ?? [];
  const materials = (data.materials as string[] | null) ?? [];
  const colors = (data.colors as string[] | null) ?? [];
  const priceAed = (data.priceFils / 100).toLocaleString("en-AE", {
    minimumFractionDigits: 2,
  });

  return (
    <div className="space-y-8">
      {/* Back link */}
      <button
        onClick={() => router.push("/gallery")}
        className="text-muted-foreground hover:text-foreground text-sm transition"
      >
        &larr; Back to Gallery
      </button>

      {/* Main product section */}
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Photo gallery */}
        <div className="space-y-3">
          {/* Main photo */}
          <div className="flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-gray-100">
            {photos.length > 0 ? (
              <img
                src={photos[selectedPhoto]}
                alt={data.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-muted-foreground text-sm">
                No image available
              </span>
            )}
          </div>

          {/* Thumbnails */}
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto">
              {photos.map((photo, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedPhoto(index)}
                  className={`h-16 w-16 flex-shrink-0 overflow-hidden rounded-md border-2 transition ${
                    selectedPhoto === index
                      ? "border-foreground"
                      : "border-transparent opacity-60 hover:opacity-100"
                  }`}
                >
                  <img
                    src={photo}
                    alt={`${data.name} photo ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product info */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <span className="bg-muted text-muted-foreground rounded-full px-3 py-1 text-xs font-medium">
                {CATEGORY_LABELS[data.category] ?? data.category.replace(/_/g, " ")}
              </span>
              {data.stockQuantity > 0 ? (
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                  In Stock
                </span>
              ) : (
                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-800">
                  Out of Stock
                </span>
              )}
            </div>
            <h1 className="text-3xl font-bold">{data.name}</h1>
            <p className="mt-2 text-2xl font-bold">AED {priceAed}</p>
          </div>

          {/* Materials */}
          {materials.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Materials</h3>
              <div className="flex flex-wrap gap-2">
                {materials.map((material, i) => (
                  <span
                    key={i}
                    className="bg-muted rounded-full px-3 py-1 text-xs"
                  >
                    {material}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Colors */}
          {colors.length > 0 && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Colors</h3>
              <div className="flex flex-wrap gap-2">
                {colors.map((color, i) => (
                  <span
                    key={i}
                    className="bg-muted rounded-full px-3 py-1 text-xs"
                  >
                    {color}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Dimensions */}
          {(data.widthCm > 0 || data.depthCm > 0 || data.heightCm > 0) && (
            <div>
              <h3 className="mb-1 text-sm font-semibold">Dimensions</h3>
              <p className="text-muted-foreground text-sm">
                {data.widthCm > 0 ? `${data.widthCm} cm W` : ""}
                {data.depthCm > 0 ? ` × ${data.depthCm} cm D` : ""}
                {data.heightCm > 0 ? ` × ${data.heightCm} cm H` : ""}
              </p>
            </div>
          )}

          {/* Retailer info */}
          <div className="border-border rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Sold by</h3>
            <p className="text-muted-foreground mt-1">
              {data.retailer.companyName}
            </p>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <Button
              onClick={handleAddToCart}
              disabled={addingToCart || data.stockQuantity <= 0}
            >
              {addingToCart ? "Adding..." : "Add to Cart"}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.push("/projects/new")}
            >
              Start a Project
            </Button>
          </div>

          {cartMessage && (
            <p
              className={`text-sm ${
                cartMessage === "Added to cart"
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              {cartMessage}
            </p>
          )}
        </div>
      </div>

      {/* Related products */}
      {data.relatedProducts.length > 0 && (
        <div>
          <h2 className="mb-4 text-xl font-semibold">Related Products</h2>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {data.relatedProducts.map((related) => {
              const relPhotos = (related.photos as string[] | null) ?? [];
              const relFirstPhoto = relPhotos[0];
              return (
                <button
                  key={related.id}
                  onClick={() =>
                    router.push(`/gallery/${related.id}`)
                  }
                  className="group overflow-hidden rounded-lg border text-left transition hover:shadow-lg"
                >
                  <div className="flex h-40 items-center justify-center bg-gray-100">
                    {relFirstPhoto ? (
                      <img
                        src={relFirstPhoto}
                        alt={related.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">
                        No image
                      </span>
                    )}
                  </div>
                  <div className="p-3">
                    <h3 className="truncate text-sm font-semibold">
                      {related.name}
                    </h3>
                    <p className="text-muted-foreground text-xs">
                      {related.retailer.companyName}
                    </p>
                    <p className="mt-1 font-bold">
                      AED{" "}
                      {(related.priceFils / 100).toLocaleString("en-AE", {
                        minimumFractionDigits: 2,
                      })}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
