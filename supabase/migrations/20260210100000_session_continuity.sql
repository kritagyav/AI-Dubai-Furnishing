-- Story 1.9: Cross-Device Session Continuity
-- Extends Session table and adds UserActivityState + OfflineAction tables

-- Add new columns to Session table
ALTER TABLE "Session"
  ADD COLUMN IF NOT EXISTS "deviceName" TEXT,
  ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
  ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
  ADD COLUMN IF NOT EXISTS "lastPath" TEXT,
  ADD COLUMN IF NOT EXISTS "lastContext" JSONB;

-- Composite index for efficient "most recent session per user" queries
CREATE INDEX IF NOT EXISTS "Session_userId_lastActiveAt_desc_idx"
  ON "Session" ("userId", "lastActiveAt" DESC);

-- User activity state for cross-device "continue where you left off"
CREATE TABLE IF NOT EXISTS "UserActivityState" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL UNIQUE,
  "currentPath" TEXT,
  "currentScreen" TEXT,
  "contextData" JSONB,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "UserActivityState_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Offline action queue with idempotency
CREATE TABLE IF NOT EXISTS "OfflineAction" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL UNIQUE,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "processedAt" TIMESTAMPTZ,
  "errorMessage" TEXT
);

CREATE INDEX IF NOT EXISTS "OfflineAction_userId_status_idx"
  ON "OfflineAction" ("userId", "status");

CREATE INDEX IF NOT EXISTS "OfflineAction_idempotencyKey_idx"
  ON "OfflineAction" ("idempotencyKey");

-- RLS policies for UserActivityState
ALTER TABLE "UserActivityState" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_activity_state" ON "UserActivityState"
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- RLS policies for OfflineAction
ALTER TABLE "OfflineAction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_offline_actions" ON "OfflineAction"
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
