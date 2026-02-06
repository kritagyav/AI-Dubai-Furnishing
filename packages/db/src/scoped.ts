import { prisma } from "./client";

/**
 * Creates a tenant-scoped Prisma client that automatically filters
 * queries by tenantId. Used for retailer-scoped and corporate-scoped
 * data access per architecture decision DA-1.
 *
 * Usage in tRPC procedures:
 *   const db = scopedClient(ctx.tenantId);
 *   const products = await db.retailerProduct.findMany();
 */
export function scopedClient(tenantId: string) {
  return prisma.$extends({
    query: {
      $allOperations({ args, query }) {
        const extendedArgs = args as Record<string, unknown>;
        extendedArgs.where = {
          ...(extendedArgs.where as Record<string, unknown> | undefined),
          retailerId: tenantId,
        };
        return query(args);
      },
    },
  });
}
