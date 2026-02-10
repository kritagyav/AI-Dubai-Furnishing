-- Migration: Room Intelligence (Stories 2.1-2.6)
-- Creates Project, Room, RoomPhoto tables and related enums

-- Enums
CREATE TYPE "RoomType" AS ENUM (
  'LIVING_ROOM', 'BEDROOM', 'DINING_ROOM', 'KITCHEN',
  'BATHROOM', 'STUDY_OFFICE', 'BALCONY', 'OTHER'
);

CREATE TYPE "RoomTypeSource" AS ENUM ('MANUAL', 'AI_SUGGESTED', 'AI_CONFIRMED');
CREATE TYPE "DimensionUnit" AS ENUM ('METRIC', 'IMPERIAL');

-- Project table
CREATE TABLE "Project" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "name" VARCHAR(200) NOT NULL,
  "address" VARCHAR(500),
  "floorPlanUrl" TEXT,
  "floorPlanThumbUrl" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Project_userId_idx" ON "Project"("userId");

-- Room table
CREATE TABLE "Room" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "projectId" UUID NOT NULL REFERENCES "Project"("id") ON DELETE CASCADE,
  "name" VARCHAR(100) NOT NULL,
  "type" "RoomType" NOT NULL DEFAULT 'OTHER',
  "typeConfidence" DOUBLE PRECISION,
  "typeSource" "RoomTypeSource" NOT NULL DEFAULT 'MANUAL',
  "widthCm" INTEGER,
  "lengthCm" INTEGER,
  "heightCm" INTEGER,
  "displayUnit" "DimensionUnit" NOT NULL DEFAULT 'METRIC',
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Room_projectId_idx" ON "Room"("projectId");

-- RoomPhoto table
CREATE TABLE "RoomPhoto" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "roomId" UUID NOT NULL REFERENCES "Room"("id") ON DELETE CASCADE,
  "storageUrl" TEXT NOT NULL,
  "thumbnailUrl" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "uploadedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "RoomPhoto_roomId_idx" ON "RoomPhoto"("roomId");

-- RLS policies
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Room" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RoomPhoto" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own projects"
  ON "Project" FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

CREATE POLICY "Users can manage rooms in own projects"
  ON "Room" FOR ALL
  USING (auth.uid()::text = (SELECT u."supabaseAuthId" FROM "User" u JOIN "Project" p ON p."userId" = u."id" WHERE p."id" = "projectId"));

CREATE POLICY "Users can manage photos in own rooms"
  ON "RoomPhoto" FOR ALL
  USING (auth.uid()::text = (SELECT u."supabaseAuthId" FROM "User" u JOIN "Project" p ON p."userId" = u."id" JOIN "Room" r ON r."projectId" = p."id" WHERE r."id" = "roomId"));
