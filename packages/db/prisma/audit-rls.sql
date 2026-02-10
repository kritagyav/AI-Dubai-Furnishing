-- Audit Log Row-Level Security Policies
-- Append-only for API role, read-only for admin role

-- Enable RLS on the AuditLog table
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

-- API role: can only INSERT (append-only)
CREATE POLICY "audit_log_api_insert" ON "AuditLog"
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- API role: no UPDATE or DELETE
CREATE POLICY "audit_log_api_no_update" ON "AuditLog"
  FOR UPDATE
  TO authenticated
  USING (false);

CREATE POLICY "audit_log_api_no_delete" ON "AuditLog"
  FOR DELETE
  TO authenticated
  USING (false);

-- Admin role: can read all audit logs
CREATE POLICY "audit_log_admin_read" ON "AuditLog"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM "User"
      WHERE "User"."supabaseAuthId" = auth.uid()::text
      AND "User"."role" = 'PLATFORM_ADMIN'
    )
  );

-- Service role bypasses RLS (for API server writes)
-- This is handled by Supabase's service_role key which bypasses RLS by default
