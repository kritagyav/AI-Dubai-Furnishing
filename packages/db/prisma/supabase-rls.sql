-- Row-Level Security Policies for Dubai AI Furnishing Platform
-- Applied via Prisma migration (paste into migration SQL file after `prisma migrate dev --create-only`)
--
-- Strategy: Use PostgreSQL session variables set via Prisma $executeRaw
-- before each request. Prisma connects directly to PostgreSQL (bypasses PostgREST),
-- so auth.uid() is not available. Instead, use current_setting('app.current_user_id').

-- Helper function: Get current user ID from session variable
CREATE OR REPLACE FUNCTION auth.current_user_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_user_id', true);
$$ LANGUAGE SQL STABLE;

-- Helper function: Get current tenant ID from session variable
CREATE OR REPLACE FUNCTION auth.current_tenant_id() RETURNS TEXT AS $$
  SELECT current_setting('app.current_tenant_id', true);
$$ LANGUAGE SQL STABLE;

-- ═══════════════════════════════════════════
-- User table RLS
-- ═══════════════════════════════════════════
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

-- Users can read their own row
CREATE POLICY "users_select_own"
  ON "User" FOR SELECT
  USING (id = auth.current_user_id());

-- Users can update their own row
CREATE POLICY "users_update_own"
  ON "User" FOR UPDATE
  USING (id = auth.current_user_id())
  WITH CHECK (id = auth.current_user_id());

-- Platform admins can read all users
CREATE POLICY "admins_select_all_users"
  ON "User" FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "User" u
      WHERE u.id = auth.current_user_id()
      AND u.role = 'PLATFORM_ADMIN'
    )
  );

-- ═══════════════════════════════════════════
-- Session table RLS
-- ═══════════════════════════════════════════
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

-- Users can read their own sessions
CREATE POLICY "sessions_select_own"
  ON "Session" FOR SELECT
  USING ("userId" = auth.current_user_id());

-- Users can delete their own sessions (logout)
CREATE POLICY "sessions_delete_own"
  ON "Session" FOR DELETE
  USING ("userId" = auth.current_user_id());
