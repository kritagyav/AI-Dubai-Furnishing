import { prisma } from "@dubai/db";
import type { PackageGeneratePayload } from "@dubai/queue";

import { logger } from "../logger";

/**
 * Package Generate Job — selects matching products for an AI-generated
 * furnishing package based on user preferences and room requirements.
 *
 * In production, this would call an AI service for style-matched selection.
 * Currently uses preference-based filtering as a simulation.
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
    log.warn({ status: pkg.status }, "Package not in GENERATING state, skipping");
    return;
  }

  // Load user preferences for budget
  const preference = await prisma.userPreference.findFirst({
    where: { userId: payload.userId, projectId: payload.projectId },
    select: {
      budgetMaxFils: true,
    },
  });

  const budgetMax = preference?.budgetMaxFils ?? 500000;

  try {
    // Select products matching budget and availability
    const products = await prisma.retailerProduct.findMany({
      where: {
        validationStatus: "ACTIVE",
        stockQuantity: { gt: 0 },
        priceFils: { lte: budgetMax },
      },
      take: 8,
      orderBy: { priceFils: "asc" },
      select: {
        id: true,
        name: true,
        priceFils: true,
        category: true,
      },
    });

    if (products.length === 0) {
      log.warn("No matching products found, marking package as expired");
      await prisma.package.update({
        where: { id: payload.packageId },
        data: { status: "EXPIRED" },
      });
      return;
    }

    // Create package items
    await prisma.packageItem.createMany({
      data: products.map((p) => ({
        packageId: payload.packageId,
        productId: p.id,
        quantity: 1,
        unitPriceFils: p.priceFils,
      })),
    });

    // Calculate total and transition to READY
    const totalFils = products.reduce((sum, p) => sum + p.priceFils, 0);

    await prisma.package.update({
      where: { id: payload.packageId },
      data: {
        status: "READY",
        totalPriceFils: totalFils,
      },
    });

    log.info(
      { itemCount: products.length, totalFils },
      "Package generated successfully",
    );

    // Create notification for the user
    await prisma.notification.create({
      data: {
        userId: payload.userId,
        type: "PACKAGE_READY",
        title: "Your furnishing package is ready!",
        body: `We've curated ${products.length} items within your budget. Review and customize your package now.`,
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
