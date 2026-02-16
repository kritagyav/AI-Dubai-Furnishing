import type { CatalogHealthCheckPayload } from "@dubai/queue";
import { prisma } from "@dubai/db";

import { logger } from "../logger";

/** Price thresholds in fils */
const MIN_PRICE_FILS = 100;
const MAX_PRICE_FILS = 50_000_000;

/** Products not updated in 30+ days are considered stale */
const STALE_THRESHOLD_DAYS = 30;

interface DetectedIssue {
  productId: string;
  issueType:
    | "STALE_STOCK"
    | "MISSING_FIELDS"
    | "PRICING_ANOMALY"
    | "BROKEN_IMAGE";
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description: string;
  recommendation?: string;
}

/**
 * Catalog Health Check Job — evaluates a retailer's product catalog
 * for quality issues and generates a health score.
 *
 * Checks performed:
 * - STALE_STOCK: products not updated in 30+ days
 * - MISSING_FIELDS: products with empty photos, no materials, or no colors
 * - PRICING_ANOMALY: products with price < 100 fils or > 50,000,000 fils
 * - BROKEN_IMAGE: products with photo URLs flagged for manual review
 */
export async function handleCatalogHealthCheck(
  payload: CatalogHealthCheckPayload,
): Promise<void> {
  const log = logger.child({
    job: "catalog.health-check",
    retailerId: payload.retailerId,
  });
  log.info("Starting catalog health check");

  const products = await prisma.retailerProduct.findMany({
    where: { retailerId: payload.retailerId },
    select: {
      id: true,
      name: true,
      sku: true,
      priceFils: true,
      photos: true,
      materials: true,
      colors: true,
      updatedAt: true,
    },
  });

  const totalProducts = products.length;

  if (totalProducts === 0) {
    log.info("No products found for retailer, creating empty health check");
    await prisma.catalogHealthCheck.create({
      data: {
        retailerId: payload.retailerId,
        overallScore: 100,
        totalProducts: 0,
        issuesFound: 0,
        staleProducts: 0,
        missingFields: 0,
        brokenImages: 0,
        pricingIssues: 0,
      },
    });
    return;
  }

  const issues: DetectedIssue[] = [];
  const staleThreshold = new Date(
    Date.now() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000,
  );

  let staleCount = 0;
  let missingFieldsCount = 0;
  let pricingCount = 0;
  let brokenImageCount = 0;

  for (const product of products) {
    // Check for stale stock
    if (product.updatedAt < staleThreshold) {
      staleCount++;
      issues.push({
        productId: product.id,
        issueType: "STALE_STOCK",
        severity: "MEDIUM",
        description: `Product "${product.name}" (SKU: ${product.sku}) has not been updated since ${product.updatedAt.toISOString().split("T")[0]}`,
        recommendation:
          "Review and update stock quantity and product details to ensure accuracy.",
      });
    }

    // Check for missing fields
    const photos = product.photos as unknown[];
    const materials = product.materials as unknown[];
    const colors = product.colors as unknown[];

    const missingParts: string[] = [];
    if (!Array.isArray(photos) || photos.length === 0) {
      missingParts.push("photos");
    }
    if (!Array.isArray(materials) || materials.length === 0) {
      missingParts.push("materials");
    }
    if (!Array.isArray(colors) || colors.length === 0) {
      missingParts.push("colors");
    }

    if (missingParts.length > 0) {
      missingFieldsCount++;
      issues.push({
        productId: product.id,
        issueType: "MISSING_FIELDS",
        severity: "HIGH",
        description: `Product "${product.name}" (SKU: ${product.sku}) is missing: ${missingParts.join(", ")}`,
        recommendation:
          "Add the missing product information to improve catalog quality and search visibility.",
      });
    }

    // Check for pricing anomalies
    if (product.priceFils < MIN_PRICE_FILS) {
      pricingCount++;
      issues.push({
        productId: product.id,
        issueType: "PRICING_ANOMALY",
        severity: "CRITICAL",
        description: `Product "${product.name}" (SKU: ${product.sku}) has suspiciously low price: ${product.priceFils} fils`,
        recommendation:
          "Verify the product price. It may be incorrectly entered in fils instead of AED.",
      });
    } else if (product.priceFils > MAX_PRICE_FILS) {
      pricingCount++;
      issues.push({
        productId: product.id,
        issueType: "PRICING_ANOMALY",
        severity: "HIGH",
        description: `Product "${product.name}" (SKU: ${product.sku}) has unusually high price: ${product.priceFils} fils`,
        recommendation:
          "Verify the product price. It may have been entered incorrectly.",
      });
    }

    // Check for broken images (flag URLs for manual review)
    if (Array.isArray(photos) && photos.length > 0) {
      brokenImageCount++;
      issues.push({
        productId: product.id,
        issueType: "BROKEN_IMAGE",
        severity: "LOW",
        description: `Product "${product.name}" (SKU: ${product.sku}) has ${photos.length} image(s) flagged for accessibility check`,
        recommendation: "Verify that all product image URLs are accessible.",
      });
    }
  }

  // Calculate overall score: 100 - (issuesFound / totalProducts * 100), clamped 0-100
  const issuesFound = issues.length;
  const rawScore = 100 - (issuesFound / totalProducts) * 100;
  const overallScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Create the health check record
  const healthCheck = await prisma.catalogHealthCheck.create({
    data: {
      retailerId: payload.retailerId,
      overallScore,
      totalProducts,
      issuesFound,
      staleProducts: staleCount,
      missingFields: missingFieldsCount,
      brokenImages: brokenImageCount,
      pricingIssues: pricingCount,
    },
  });

  // Create individual issue records
  if (issues.length > 0) {
    await prisma.catalogIssue.createMany({
      data: issues.map((issue) => ({
        retailerId: payload.retailerId,
        productId: issue.productId,
        issueType: issue.issueType,
        severity: issue.severity,
        description: issue.description,
        recommendation: issue.recommendation ?? null,
      })),
    });
  }

  log.info(
    {
      healthCheckId: healthCheck.id,
      overallScore,
      totalProducts,
      issuesFound,
      staleProducts: staleCount,
      missingFields: missingFieldsCount,
      brokenImages: brokenImageCount,
      pricingIssues: pricingCount,
    },
    "Catalog health check completed",
  );
}
