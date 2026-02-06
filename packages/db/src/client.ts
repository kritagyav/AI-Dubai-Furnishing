import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  // TODO(Story 1.2): Replace accelerateUrl workaround with proper Prisma adapter.
  // Prisma 7.x requires an adapter or accelerateUrl. Using accelerateUrl with a
  // plain PostgreSQL URL is a temporary hack to pass build. Story 1.2 will provision
  // Supabase and configure the proper @prisma/adapter-pg adapter.
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  return new PrismaClient({
    accelerateUrl: databaseUrl,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

// Lazy initialization - only create client when first accessed
let _prisma: PrismaClient | undefined;

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    if (!_prisma) {
      _prisma = globalForPrisma.prisma ?? createPrismaClient();
      if (process.env.NODE_ENV !== "production") {
        globalForPrisma.prisma = _prisma;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return Reflect.get(_prisma, prop);
  },
});
