import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Test fixtures per architecture spec: Priya (user), Ahmed (retailer_admin), Layla (platform_admin)
  const priya = await prisma.user.upsert({
    where: { email: "priya@example.com" },
    update: {},
    create: {
      id: "user-1",
      supabaseAuthId: "supabase-auth-user-1",
      email: "priya@example.com",
      name: "Priya Sharma",
      role: "USER",
      tenantId: null,
    },
  });

  const ahmed = await prisma.user.upsert({
    where: { email: "ahmed@retailer.com" },
    update: {},
    create: {
      id: "ret-1",
      supabaseAuthId: "supabase-auth-ret-1",
      email: "ahmed@retailer.com",
      name: "Ahmed Al-Rashidi",
      role: "RETAILER_ADMIN",
      tenantId: "retailer-1",
    },
  });

  const layla = await prisma.user.upsert({
    where: { email: "layla@platform.com" },
    update: {},
    create: {
      id: "adm-1",
      supabaseAuthId: "supabase-auth-adm-1",
      email: "layla@platform.com",
      name: "Layla Osman",
      role: "PLATFORM_ADMIN",
      tenantId: null,
    },
  });

  console.log("Seeded users:", { priya: priya.id, ahmed: ahmed.id, layla: layla.id });
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
