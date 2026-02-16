import type { AvailableProduct } from "@dubai/ai-client";
import type { PackageGeneratePayload } from "@dubai/queue";
import { AIClient } from "@dubai/ai-client";
import { prisma } from "@dubai/db";

import { logger } from "../logger";

/** Shared AI client instance for package generation jobs. */
const aiClient = new AIClient({
  timeoutMs: 45_000, // longer timeout for worker jobs — not user-facing
  maxRetries: 2,
});

/**
 * Package Generate Job — selects matching products for an AI-generated
 * furnishing package based on user preferences and room requirements.
 *
 * Uses the @dubai/ai-client to call an AI service for style-matched
 * selection. Falls back to rule-based selection when AI is unavailable.
 */
export async function handlePackageGenerate(
  payload: PackageGeneratePayload,
): Promise<void> {
  const log = logger.child({
    job: "package.generate",
    packageId: payload.packageId,
    projectId: payload.projectId,
  });
  log.info("Generating furnishing package");

  const pkg = await prisma.package.findUnique({
    where: { id: payload.packageId },
    select: { id: true, status: true, projectId: true },
  });

  if (!pkg) {
    log.warn("Package not found, skipping");
    return;
  }

  if (pkg.status !== "GENERATING") {
    log.warn(
      { status: pkg.status },
      "Package not in GENERATING state, skipping",
    );
    return;
  }

  // Load user preferences for budget and style
  const preference = await prisma.userPreference.findFirst({
    where: { userId: payload.userId, projectId: payload.projectId },
    select: {
      budgetMinFils: true,
      budgetMaxFils: true,
      stylePreferences: true,
    },
  });

  const budgetMax = preference?.budgetMaxFils ?? 500000;
  const budgetMin = preference?.budgetMinFils ?? undefined;

  // Parse style preferences from JSON field
  const stylePreferences: string[] = Array.isArray(preference?.stylePreferences)
    ? (preference.stylePreferences as string[])
    : [];

  try {
    // Fetch candidate products within budget and availability constraints
    const rawProducts = await prisma.retailerProduct.findMany({
      where: {
        validationStatus: "ACTIVE",
        stockQuantity: { gt: 0 },
        priceFils: { lte: budgetMax },
      },
      take: 50, // fetch a broader pool for AI to select from
      orderBy: { priceFils: "asc" },
      select: {
        id: true,
        name: true,
        priceFils: true,
        category: true,
        materials: true,
        colors: true,
        stockQuantity: true,
      },
    });

    if (rawProducts.length === 0) {
      log.warn("No matching products found, marking package as expired");
      await prisma.package.update({
        where: { id: payload.packageId },
        data: { status: "EXPIRED" },
      });
      return;
    }

    // Map DB products to the AI client's AvailableProduct type
    const availableProducts: AvailableProduct[] = rawProducts.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category as AvailableProduct["category"],
      priceFils: p.priceFils,
      materials: Array.isArray(p.materials)
        ? (p.materials as string[])
        : undefined,
      colors: Array.isArray(p.colors) ? (p.colors as string[]) : undefined,
      stockQuantity: p.stockQuantity,
    }));

    // Call AI client for intelligent product selection
    const recommendation = await aiClient.generatePackageRecommendation({
      budgetMinFils: budgetMin,
      budgetMaxFils: budgetMax,
      stylePreferences,
      roomType: payload.roomId ? undefined : undefined, // room type resolution could be added later
      styleTag: payload.styleTag,
      availableProducts,
      maxItems: 8,
    });

    log.info(
      {
        source: recommendation.source,
        itemCount: recommendation.selectedProducts.length,
      },
      "AI recommendation received",
    );

    if (recommendation.selectedProducts.length === 0) {
      log.warn("AI returned no product selections, marking package as expired");
      await prisma.package.update({
        where: { id: payload.packageId },
        data: { status: "EXPIRED" },
      });
      return;
    }

    // Create package items from AI selection
    await prisma.packageItem.createMany({
      data: recommendation.selectedProducts.map((sel) => {
        const product = rawProducts.find((p) => p.id === sel.productId);
        return {
          packageId: payload.packageId,
          productId: sel.productId,
          quantity: sel.quantity,
          unitPriceFils: product?.priceFils ?? 0,
        };
      }),
    });

    // Transition to READY with total price and metadata
    await prisma.package.update({
      where: { id: payload.packageId },
      data: {
        status: "READY",
        totalPriceFils: recommendation.totalPriceFils,
        styleTag: payload.styleTag ?? stylePreferences[0] ?? null,
        aiModelVersion:
          recommendation.source === "ai" ? "ai-v1" : "fallback-v1",
        generatedAt: new Date(),
      },
    });

    log.info(
      {
        itemCount: recommendation.selectedProducts.length,
        totalFils: recommendation.totalPriceFils,
        source: recommendation.source,
      },
      "Package generated successfully",
    );

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: "PACKAGE_READY",
        title: "Your furnishing package is ready!",
        body: `We've curated ${recommendation.selectedProducts.length} items within your budget. Review and customize your package now.`,
      },
    });
  } catch (err) {
    log.error({ err }, "Failed to generate package");

    // Mark package as expired on failure
    await prisma.package.update({
      where: { id: payload.packageId },
      data: { status: "EXPIRED" },
    });
  }
}
