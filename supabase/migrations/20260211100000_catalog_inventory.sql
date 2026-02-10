-- Migration: Catalog & Inventory (Stories 5.1-5.2)
-- Creates Retailer, RetailerProduct tables and related enums

-- Enums
CREATE TYPE "RetailerStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');
CREATE TYPE "ProductValidationStatus" AS ENUM ('ACTIVE', 'PENDING', 'REJECTED');
CREATE TYPE "FurnitureCategory" AS ENUM (
  'SOFA', 'BED', 'DINING_TABLE', 'DINING_CHAIR', 'DESK', 'OFFICE_CHAIR',
  'WARDROBE', 'DRESSER', 'BOOKSHELF', 'TV_UNIT', 'COFFEE_TABLE', 'SIDE_TABLE',
  'RUG', 'CURTAIN', 'LIGHTING', 'MIRROR', 'STORAGE', 'OUTDOOR', 'DECOR', 'OTHER'
);

-- Retailer table
CREATE TABLE "Retailer" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL UNIQUE REFERENCES "User"("id") ON DELETE CASCADE,
  "companyName" VARCHAR(200) NOT NULL,
  "tradeLicenseNumber" VARCHAR(100) NOT NULL,
  "contactEmail" VARCHAR(255) NOT NULL,
  "contactPhone" VARCHAR(20),
  "businessType" VARCHAR(100),
  "status" "RetailerStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "warehouseDetails" JSONB,
  "documentsUrl" TEXT,
  "commissionRate" INTEGER NOT NULL DEFAULT 1200,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Retailer_tenantId_idx" ON "Retailer"("tenantId");
CREATE INDEX "Retailer_status_idx" ON "Retailer"("status");

-- RetailerProduct table
CREATE TABLE "RetailerProduct" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "retailerId" UUID NOT NULL REFERENCES "Retailer"("id") ON DELETE CASCADE,
  "tenantId" UUID NOT NULL,
  "sku" VARCHAR(100) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "category" "FurnitureCategory" NOT NULL,
  "widthCm" INTEGER NOT NULL,
  "depthCm" INTEGER NOT NULL,
  "heightCm" INTEGER NOT NULL,
  "materials" JSONB NOT NULL,
  "colors" JSONB NOT NULL,
  "priceFils" INTEGER NOT NULL,
  "photos" JSONB NOT NULL,
  "stockQuantity" INTEGER NOT NULL DEFAULT 0,
  "validationStatus" "ProductValidationStatus" NOT NULL DEFAULT 'PENDING',
  "validationErrors" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE ("retailerId", "sku")
);

CREATE INDEX "RetailerProduct_tenantId_idx" ON "RetailerProduct"("tenantId");
CREATE INDEX "RetailerProduct_category_status_idx" ON "RetailerProduct"("category", "validationStatus");

-- RLS policies
ALTER TABLE "Retailer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RetailerProduct" ENABLE ROW LEVEL SECURITY;

-- Retailers can see their own record
CREATE POLICY "Retailers can manage own record"
  ON "Retailer" FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can see all retailers
CREATE POLICY "Admins can manage all retailers"
  ON "Retailer" FOR ALL
  USING (auth.uid()::text IN (SELECT "supabaseAuthId" FROM "User" WHERE "role" = 'PLATFORM_ADMIN'));

-- Retailers can manage own products
CREATE POLICY "Retailers can manage own products"
  ON "RetailerProduct" FOR ALL
  USING ("tenantId" = (SELECT "tenantId" FROM "Retailer" WHERE "userId" = (SELECT "id" FROM "User" WHERE "supabaseAuthId" = auth.uid()::text)));
