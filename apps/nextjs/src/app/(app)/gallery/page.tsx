"use client";

import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

/**
 * Style Gallery — discovery page for the JUST_BROWSING path.
 * Shows curated apartment styles for inspiration.
 */

const STYLES = [
  {
    id: "modern-minimal",
    name: "Modern Minimalist",
    description: "Clean lines, neutral tones, and functional furniture",
    color: "bg-gray-100",
  },
  {
    id: "arabic-contemporary",
    name: "Arabic Contemporary",
    description: "Traditional motifs blended with modern design",
    color: "bg-amber-50",
  },
  {
    id: "scandinavian",
    name: "Scandinavian",
    description: "Light wood, cozy textiles, and bright open spaces",
    color: "bg-blue-50",
  },
  {
    id: "industrial-chic",
    name: "Industrial Chic",
    description: "Exposed materials, metal accents, and urban character",
    color: "bg-stone-100",
  },
  {
    id: "luxury-classic",
    name: "Luxury Classic",
    description: "Rich fabrics, ornate details, and timeless elegance",
    color: "bg-purple-50",
  },
  {
    id: "coastal-living",
    name: "Coastal Living",
    description: "Light and airy with ocean-inspired palettes",
    color: "bg-cyan-50",
  },
];

export default function GalleryPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Style Gallery</h1>
        <p className="text-muted-foreground mt-1">
          Browse apartment styles for inspiration. When you find one you love,
          start a project to furnish your space.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {STYLES.map((style) => (
          <div
            key={style.id}
            className="group overflow-hidden rounded-lg border transition hover:shadow-lg"
          >
            <div
              className={`${style.color} flex h-48 items-center justify-center`}
            >
              <span className="text-muted-foreground text-sm">
                Style preview
              </span>
            </div>
            <div className="p-4">
              <h3 className="font-semibold">{style.name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                {style.description}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => router.push("/projects/new")}
              >
                Furnish in this style
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
