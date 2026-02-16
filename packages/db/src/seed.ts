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

  // Seed delivery slots for next 14 days across Dubai areas
  const areas = ["Dubai Marina", "Downtown Dubai", "JBR", "Business Bay", "Deira", "Jumeirah"];
  const timeSlots = [
    { startTime: "09:00", endTime: "12:00" },
    { startTime: "12:00", endTime: "15:00" },
    { startTime: "15:00", endTime: "18:00" },
    { startTime: "18:00", endTime: "21:00" },
  ];

  let slotsCreated = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);

    for (const area of areas) {
      for (const slot of timeSlots) {
        try {
          await prisma.deliverySlot.create({
            data: {
              date,
              startTime: slot.startTime,
              endTime: slot.endTime,
              capacity: 10,
              area,
            },
          });
          slotsCreated++;
        } catch {
          // Ignore duplicates
        }
      }
    }
  }

  console.log(`Seeded ${slotsCreated} delivery slots across ${areas.length} areas for 14 days`);

  // Seed a sample retailer with products for Ahmed
  const retailer = await prisma.retailer.upsert({
    where: { userId: ahmed.id },
    update: {},
    create: {
      userId: ahmed.id,
      companyName: "Al-Rashidi Furnishings",
      tradeLicenseNumber: "TL-2024-001",
      contactEmail: "ahmed@retailer.com",
      contactPhone: "+971501234567",
      status: "APPROVED",
      commissionRate: 1200,
    },
  });

  const sampleProducts: Array<{
    name: string;
    category: "SOFA" | "BED" | "DINING_TABLE" | "DESK" | "WARDROBE" | "BOOKSHELF" | "LIGHTING" | "RUG";
    priceFils: number;
    sku: string;
  }> = [
    { name: "Modern Leather Sofa", category: "SOFA", priceFils: 450000, sku: "ARS-SOFA-001" },
    { name: "King Size Platform Bed", category: "BED", priceFils: 380000, sku: "ARS-BED-001" },
    { name: "Oak Dining Table (6 Seater)", category: "DINING_TABLE", priceFils: 280000, sku: "ARS-DIN-001" },
    { name: "Walnut Executive Desk", category: "DESK", priceFils: 220000, sku: "ARS-DSK-001" },
    { name: "Sliding Door Wardrobe", category: "WARDROBE", priceFils: 350000, sku: "ARS-WRD-001" },
    { name: "Contemporary Bookshelf", category: "BOOKSHELF", priceFils: 120000, sku: "ARS-BKS-001" },
    { name: "Pendant Light Fixture", category: "LIGHTING", priceFils: 45000, sku: "ARS-LGT-001" },
    { name: "Persian Silk Rug (3x5m)", category: "RUG", priceFils: 680000, sku: "ARS-RUG-001" },
  ];

  let productsCreated = 0;
  for (const p of sampleProducts) {
    try {
      await prisma.retailerProduct.create({
        data: {
          retailerId: retailer.id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          priceFils: p.priceFils,
          widthCm: 100,
          depthCm: 60,
          heightCm: 80,
          stockQuantity: 25,
          validationStatus: "ACTIVE",
          materials: ["Wood", "Metal"],
          colors: ["Natural", "Black"],
          photos: [],
        },
      });
      productsCreated++;
    } catch {
      // Ignore duplicates
    }
  }

  console.log(`Seeded retailer "${retailer.companyName}" with ${productsCreated} products`);
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
