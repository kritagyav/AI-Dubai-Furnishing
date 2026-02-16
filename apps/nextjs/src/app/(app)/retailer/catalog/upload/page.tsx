"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

const CATEGORIES = [
  "SOFA",
  "BED",
  "DINING_TABLE",
  "DINING_CHAIR",
  "DESK",
  "OFFICE_CHAIR",
  "WARDROBE",
  "DRESSER",
  "BOOKSHELF",
  "TV_UNIT",
  "COFFEE_TABLE",
  "SIDE_TABLE",
  "RUG",
  "CURTAIN",
  "LIGHTING",
  "MIRROR",
  "STORAGE",
  "OUTDOOR",
  "DECOR",
  "OTHER",
] as const;

type FurnitureCategory = (typeof CATEGORIES)[number];

interface ProductEntry {
  name: string;
  sku: string;
  category: FurnitureCategory;
  dimensions: { widthCm: number; depthCm: number; heightCm: number };
  materials: string[];
  colors: string[];
  priceFils: number;
  photos: string[];
  stockQuantity: number;
}

function emptyProduct(): ProductEntry {
  return {
    name: "",
    sku: "",
    category: "SOFA",
    dimensions: { widthCm: 0, depthCm: 0, heightCm: 0 },
    materials: [],
    colors: [],
    priceFils: 0,
    photos: [],
    stockQuantity: 0,
  };
}

type UploadMode = "form" | "csv";

export default function CatalogUploadPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [mode, setMode] = useState<UploadMode>("form");
  const [products, setProducts] = useState<ProductEntry[]>([emptyProduct()]);
  const [csvText, setCsvText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    total: number;
    succeeded: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Form mode helpers ───

  function updateProduct(index: number, updates: Partial<ProductEntry>) {
    setProducts((prev) =>
      prev.map((p, i) => (i === index ? { ...p, ...updates } : p)),
    );
  }

  function addProduct() {
    setProducts((prev) => [...prev, emptyProduct()]);
  }

  function removeProduct(index: number) {
    setProducts((prev) => prev.filter((_, i) => i !== index));
  }

  // ─── CSV parsing ───

  function parseCsv(text: string): ProductEntry[] {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];

    const headers = (lines[0] ?? "")
      .split(",")
      .map((h) => h.trim().toLowerCase());
    const entries: ProductEntry[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = (lines[i] ?? "").split(",").map((c) => c.trim());
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => {
        row[h] = cols[idx] ?? "";
      });

      entries.push({
        name: row.name ?? "",
        sku: row.sku ?? "",
        category: (row.category ?? "OTHER").toUpperCase() as FurnitureCategory,
        dimensions: {
          widthCm: parseInt(row.width_cm ?? "0") || 0,
          depthCm: parseInt(row.depth_cm ?? "0") || 0,
          heightCm: parseInt(row.height_cm ?? "0") || 0,
        },
        materials: (row.materials ?? "").split(";").filter(Boolean),
        colors: (row.colors ?? "").split(";").filter(Boolean),
        priceFils: parseInt(row.price_fils ?? "0") || 0,
        photos: (row.photos ?? "").split(";").filter(Boolean),
        stockQuantity: parseInt(row.stock ?? "0") || 0,
      });
    }

    return entries;
  }

  // ─── Submit ───

  async function handleSubmit() {
    setError(null);
    setResult(null);

    const items = mode === "csv" ? parseCsv(csvText) : products;

    if (items.length === 0) {
      setError("No products to upload");
      return;
    }

    // Basic validation
    for (let i = 0; i < items.length; i++) {
      const p = items[i];
      if (!p) continue;
      if (!p.name || !p.sku) {
        setError(`Product ${i + 1}: name and SKU are required`);
        return;
      }
      if (p.priceFils <= 0) {
        setError(`Product ${i + 1}: price must be positive`);
        return;
      }
      if (p.photos.length === 0) {
        setError(`Product ${i + 1}: at least one photo URL is required`);
        return;
      }
      if (p.materials.length === 0) {
        setError(`Product ${i + 1}: at least one material is required`);
        return;
      }
      if (p.colors.length === 0) {
        setError(`Product ${i + 1}: at least one color is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await client.catalog.ingestProducts.mutate({
        products: items,
      });
      setResult({
        total: res.total,
        succeeded: res.succeeded,
        failed: res.failed,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (result) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-light)]">
          <span className="text-2xl text-[var(--color-success-default)]">
            &#10003;
          </span>
        </div>
        <h1 className="text-3xl font-bold">Upload Complete</h1>
        <p className="text-muted-foreground">
          {result.succeeded} of {result.total} products uploaded successfully.
          {result.failed > 0 && (
            <span className="text-[var(--color-error-default)]">
              {" "}
              {result.failed} failed.
            </span>
          )}
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => router.push("/retailer/catalog")}>
            View Catalog
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setResult(null);
              setProducts([emptyProduct()]);
              setCsvText("");
            }}
          >
            Upload More
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Products</h1>
        <p className="text-muted-foreground mt-1">
          Add products to your catalog via form or CSV upload
        </p>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode("form")}
          className={`rounded-md border px-4 py-2 text-sm ${
            mode === "form"
              ? "border-foreground bg-foreground text-background"
              : "border-input hover:border-foreground/30"
          }`}
        >
          Manual Entry
        </button>
        <button
          onClick={() => setMode("csv")}
          className={`rounded-md border px-4 py-2 text-sm ${
            mode === "csv"
              ? "border-foreground bg-foreground text-background"
              : "border-input hover:border-foreground/30"
          }`}
        >
          CSV Upload
        </button>
      </div>

      {error && (
        <div className="rounded-md border border-[var(--color-error-default)]/20 bg-[var(--color-error-light)] p-3 text-sm text-[var(--color-error-dark)]">
          {error}
        </div>
      )}

      {mode === "csv" ? (
        <div className="bg-card space-y-4 rounded-lg p-6 shadow-xs">
          <h2 className="text-lg font-semibold">CSV Format</h2>
          <p className="text-muted-foreground text-sm">
            Columns: name, sku, category, width_cm, depth_cm, height_cm,
            materials (semicolon-separated), colors (semicolon-separated),
            price_fils, photos (semicolon-separated), stock
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder={`name,sku,category,width_cm,depth_cm,height_cm,materials,colors,price_fils,photos,stock\nModern Sofa,SKU-001,SOFA,200,90,85,fabric;wood,grey;brown,45000,https://cdn.example.com/sofa.jpg,10`}
            className="h-48 w-full rounded-md border px-3 py-2 font-mono text-sm"
          />
          <Button
            className="w-full"
            disabled={submitting || !csvText.trim()}
            onClick={handleSubmit}
          >
            {submitting ? "Uploading..." : "Upload CSV"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {products.map((product, index) => (
            <div
              key={index}
              className="bg-card space-y-4 rounded-lg p-6 shadow-xs"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Product {index + 1}</h2>
                {products.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeProduct(index)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) =>
                      updateProduct(index, { name: e.target.value })
                    }
                    placeholder="Product name"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">SKU *</label>
                  <input
                    type="text"
                    value={product.sku}
                    onChange={(e) =>
                      updateProduct(index, { sku: e.target.value })
                    }
                    placeholder="SKU-001"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Category *</label>
                  <select
                    value={product.category}
                    onChange={(e) =>
                      updateProduct(index, {
                        category: e.target.value as FurnitureCategory,
                      })
                    }
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium">Price (fils) *</label>
                  <input
                    type="number"
                    value={product.priceFils || ""}
                    onChange={(e) =>
                      updateProduct(index, {
                        priceFils: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="e.g. 45000 = 450 AED"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="text-sm font-medium">Width (cm)</label>
                  <input
                    type="number"
                    value={product.dimensions.widthCm || ""}
                    onChange={(e) =>
                      updateProduct(index, {
                        dimensions: {
                          ...product.dimensions,
                          widthCm: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Depth (cm)</label>
                  <input
                    type="number"
                    value={product.dimensions.depthCm || ""}
                    onChange={(e) =>
                      updateProduct(index, {
                        dimensions: {
                          ...product.dimensions,
                          depthCm: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Height (cm)</label>
                  <input
                    type="number"
                    value={product.dimensions.heightCm || ""}
                    onChange={(e) =>
                      updateProduct(index, {
                        dimensions: {
                          ...product.dimensions,
                          heightCm: parseInt(e.target.value) || 0,
                        },
                      })
                    }
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">
                    Materials * (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={product.materials.join(", ")}
                    onChange={(e) =>
                      updateProduct(index, {
                        materials: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="wood, fabric, metal"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">
                    Colors * (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={product.colors.join(", ")}
                    onChange={(e) =>
                      updateProduct(index, {
                        colors: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="grey, brown, white"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">
                    Photo URLs * (comma-separated)
                  </label>
                  <input
                    type="text"
                    value={product.photos.join(", ")}
                    onChange={(e) =>
                      updateProduct(index, {
                        photos: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="https://cdn.example.com/photo1.jpg"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Stock Quantity</label>
                  <input
                    type="number"
                    value={product.stockQuantity || ""}
                    onChange={(e) =>
                      updateProduct(index, {
                        stockQuantity: parseInt(e.target.value) || 0,
                      })
                    }
                    placeholder="0"
                    className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>
          ))}

          <div className="flex gap-3">
            <Button variant="outline" onClick={addProduct}>
              Add Another Product
            </Button>
            <Button
              className="flex-1"
              disabled={submitting}
              onClick={handleSubmit}
            >
              {submitting
                ? "Uploading..."
                : `Upload ${products.length} Product${products.length > 1 ? "s" : ""}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
