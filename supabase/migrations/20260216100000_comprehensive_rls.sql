-- =======================================================================
-- Comprehensive Row Level Security (RLS) Migration
-- Dubai AI Furnishing Platform
-- 
-- This migration adds RLS policies for ALL tables that were previously
-- missing them, and fixes the overly permissive policies on
-- UserActivityState and OfflineAction.
--
-- Tables SKIPPED (already have proper RLS):
--   Project, Room, RoomPhoto       (room_intelligence migration)
--   Retailer, RetailerProduct      (catalog_inventory migration)
--
-- Tables FIXED (overly permissive -> user-scoped):
--   UserActivityState, OfflineAction (session_continuity migration)
-- =======================================================================

-- -----------------------------------------
-- Wrap in a transaction
-- -----------------------------------------
BEGIN;

-- =======================================================
-- FIX: UserActivityState - drop permissive policy, add user-scoped
-- =======================================================

DROP POLICY IF EXISTS "users_own_activity_state" ON "UserActivityState";

CREATE POLICY "users_own_activity_state" ON "UserActivityState"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- =======================================================
-- FIX: OfflineAction - drop permissive policy, add user-scoped
-- =======================================================

DROP POLICY IF EXISTS "users_own_offline_actions" ON "OfflineAction";

CREATE POLICY "users_own_offline_actions" ON "OfflineAction"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- =======================================================
-- IDENTITY & ACCESS
-- =======================================================

-- User: users can read/update their own row
ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_user" ON "User"
  FOR ALL
  USING (auth.uid()::text = "supabaseAuthId")
  WITH CHECK (auth.uid()::text = "supabaseAuthId");

-- Platform admins can see all users
CREATE POLICY "admins_all_users" ON "User"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" u WHERE u."supabaseAuthId" = auth.uid()::text AND u.role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" u WHERE u."supabaseAuthId" = auth.uid()::text AND u.role = 'PLATFORM_ADMIN'));

-- Session: users can manage their own sessions
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON "Session"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- =======================================================
-- LIFESTYLE DISCOVERY & PREFERENCES
-- =======================================================

-- UserPreference: users manage their own preferences
ALTER TABLE "UserPreference" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_preferences" ON "UserPreference"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- InvestorPreference: access via parent UserPreference ownership
ALTER TABLE "InvestorPreference" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_investor_preference" ON "InvestorPreference"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "UserPreference" up
      JOIN "User" u ON u."id" = up."userId"
      WHERE up."id" = "preferenceId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "UserPreference" up
      JOIN "User" u ON u."id" = up."userId"
      WHERE up."id" = "preferenceId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- ChildSafetyPreference: access via parent UserPreference ownership
ALTER TABLE "ChildSafetyPreference" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_child_safety_preference" ON "ChildSafetyPreference"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "UserPreference" up
      JOIN "User" u ON u."id" = up."userId"
      WHERE up."id" = "preferenceId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "UserPreference" up
      JOIN "User" u ON u."id" = up."userId"
      WHERE up."id" = "preferenceId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- =======================================================
-- AI PACKAGES
-- =======================================================

-- Package: users manage their own packages
ALTER TABLE "Package" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_packages" ON "Package"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- PackageItem: access via parent Package ownership
ALTER TABLE "PackageItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_package_items" ON "PackageItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Package" p
      JOIN "User" u ON u."id" = p."userId"
      WHERE p."id" = "packageId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Package" p
      JOIN "User" u ON u."id" = p."userId"
      WHERE p."id" = "packageId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- PackageReview: users manage their own reviews
ALTER TABLE "PackageReview" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_package_reviews" ON "PackageReview"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- PackagePreview: access via parent Package ownership
ALTER TABLE "PackagePreview" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_package_previews" ON "PackagePreview"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Package" p
      JOIN "User" u ON u."id" = p."userId"
      WHERE p."id" = "packageId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Package" p
      JOIN "User" u ON u."id" = p."userId"
      WHERE p."id" = "packageId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- =======================================================
-- INVENTORY SYNC
-- =======================================================

-- InventorySyncConfig: retailer-owned
ALTER TABLE "InventorySyncConfig" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_sync_config" ON "InventorySyncConfig"
  FOR ALL
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all sync configs
CREATE POLICY "admins_all_sync_configs" ON "InventorySyncConfig"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- InventorySyncJob: retailer-owned
ALTER TABLE "InventorySyncJob" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_sync_jobs" ON "InventorySyncJob"
  FOR ALL
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all sync jobs
CREATE POLICY "admins_all_sync_jobs" ON "InventorySyncJob"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- COMMERCE & ORDERS
-- =======================================================

-- Cart: user-owned (userId is unique, one cart per user)
ALTER TABLE "Cart" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cart" ON "Cart"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- CartItem: access via parent Cart ownership
ALTER TABLE "CartItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_cart_items" ON "CartItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Cart" c
      JOIN "User" u ON u."id" = c."userId"
      WHERE c."id" = "cartId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Cart" c
      JOIN "User" u ON u."id" = c."userId"
      WHERE c."id" = "cartId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Order: user-owned
ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_orders" ON "Order"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can manage all orders
CREATE POLICY "admins_all_orders" ON "Order"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- OrderLineItem: access via parent Order ownership
ALTER TABLE "OrderLineItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_order_line_items" ON "OrderLineItem"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = "orderId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = "orderId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Retailers can view line items for their products
CREATE POLICY "retailers_view_own_line_items" ON "OrderLineItem"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all order line items
CREATE POLICY "admins_all_order_line_items" ON "OrderLineItem"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- Payment: access via parent Order ownership
ALTER TABLE "Payment" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_payments" ON "Payment"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = "orderId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = "orderId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all payments
CREATE POLICY "admins_all_payments" ON "Payment"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- FINANCIAL LEDGER
-- =======================================================

-- Commission: retailer-owned (read-only for retailers)
ALTER TABLE "Commission" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_commissions" ON "Commission"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all commissions
CREATE POLICY "admins_all_commissions" ON "Commission"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- Settlement: retailer-owned (read-only for retailers)
ALTER TABLE "Settlement" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_settlements" ON "Settlement"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all settlements
CREATE POLICY "admins_all_settlements" ON "Settlement"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- LedgerEntry: retailer-owned (read-only for retailers)
ALTER TABLE "LedgerEntry" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_ledger_entries" ON "LedgerEntry"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all ledger entries
CREATE POLICY "admins_all_ledger_entries" ON "LedgerEntry"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- DELIVERY & FULFILLMENT
-- =======================================================

-- DeliverySchedule: access via orderId -> Order ownership (read-only for users)
ALTER TABLE "DeliverySchedule" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_delivery_schedules" ON "DeliverySchedule"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "Order" o
      JOIN "User" u ON u."id" = o."userId"
      WHERE o."id" = "orderId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all delivery schedules
CREATE POLICY "admins_all_delivery_schedules" ON "DeliverySchedule"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- DeliverySlot: public-read for active slots, admin-write
ALTER TABLE "DeliverySlot" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_can_read_delivery_slots" ON "DeliverySlot"
  FOR SELECT
  USING ("isActive" = true);

CREATE POLICY "admins_manage_delivery_slots" ON "DeliverySlot"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- DeliveryIssue: access via parent DeliverySchedule -> Order ownership
ALTER TABLE "DeliveryIssue" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_delivery_issues" ON "DeliveryIssue"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "DeliverySchedule" ds
      JOIN "Order" o ON o."id" = ds."orderId"
      JOIN "User" u ON u."id" = o."userId"
      WHERE ds."id" = "deliveryId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "DeliverySchedule" ds
      JOIN "Order" o ON o."id" = ds."orderId"
      JOIN "User" u ON u."id" = o."userId"
      WHERE ds."id" = "deliveryId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all delivery issues
CREATE POLICY "admins_all_delivery_issues" ON "DeliveryIssue"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- ENGAGEMENT & LIFECYCLE
-- =======================================================

-- Notification: user-owned
ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_notifications" ON "Notification"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- SatisfactionSurvey: user-owned
ALTER TABLE "SatisfactionSurvey" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_satisfaction_surveys" ON "SatisfactionSurvey"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can read all surveys
CREATE POLICY "admins_read_all_surveys" ON "SatisfactionSurvey"
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- AbandonedCart: user-owned
ALTER TABLE "AbandonedCart" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_abandoned_carts" ON "AbandonedCart"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can manage abandoned carts (for re-engagement)
CREATE POLICY "admins_all_abandoned_carts" ON "AbandonedCart"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- ReEngagementSequence: user-owned (read-only for users, managed by system)
ALTER TABLE "ReEngagementSequence" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_sequences" ON "ReEngagementSequence"
  FOR SELECT
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can manage all re-engagement sequences
CREATE POLICY "admins_all_sequences" ON "ReEngagementSequence"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- CATALOG HEALTH
-- =======================================================

-- CatalogHealthCheck: retailer-owned (read-only for retailers)
ALTER TABLE "CatalogHealthCheck" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_health_checks" ON "CatalogHealthCheck"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all health checks
CREATE POLICY "admins_all_health_checks" ON "CatalogHealthCheck"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- CatalogIssue: retailer-owned (read-only for retailers)
ALTER TABLE "CatalogIssue" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retailer_owns_catalog_issues" ON "CatalogIssue"
  FOR SELECT
  USING (
    "retailerId" IN (
      SELECT r."id" FROM "Retailer" r
      JOIN "User" u ON u."id" = r."userId"
      WHERE u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all catalog issues
CREATE POLICY "admins_all_catalog_issues" ON "CatalogIssue"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- ANALYTICS EVENTS
-- =======================================================

-- AnalyticsEvent: users can read their own events, only service_role/admins can write
ALTER TABLE "AnalyticsEvent" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_analytics" ON "AnalyticsEvent"
  FOR SELECT
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can manage all analytics events
CREATE POLICY "admins_all_analytics_events" ON "AnalyticsEvent"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- PLATFORM OPERATIONS
-- =======================================================

-- SupportTicket: user-owned
ALTER TABLE "SupportTicket" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_support_tickets" ON "SupportTicket"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Support agents and platform admins can manage all tickets
CREATE POLICY "support_all_tickets" ON "SupportTicket"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role IN ('PLATFORM_ADMIN', 'SUPPORT_AGENT')))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role IN ('PLATFORM_ADMIN', 'SUPPORT_AGENT')));

-- TicketMessage: access via parent SupportTicket
ALTER TABLE "TicketMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_ticket_messages" ON "TicketMessage"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "SupportTicket" st
      JOIN "User" u ON u."id" = st."userId"
      WHERE st."id" = "ticketId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "SupportTicket" st
      JOIN "User" u ON u."id" = st."userId"
      WHERE st."id" = "ticketId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Support agents and platform admins can manage all ticket messages
CREATE POLICY "support_all_ticket_messages" ON "TicketMessage"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role IN ('PLATFORM_ADMIN', 'SUPPORT_AGENT')))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role IN ('PLATFORM_ADMIN', 'SUPPORT_AGENT')));

-- AuditLog: admin-only
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_audit_log" ON "AuditLog"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- =======================================================
-- B2B2C DISTRIBUTION
-- =======================================================

-- AgentPartner: user-owned
ALTER TABLE "AgentPartner" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_agent_partner" ON "AgentPartner"
  FOR ALL
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"))
  WITH CHECK (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

-- Platform admins can manage all agent partners
CREATE POLICY "admins_all_agent_partners" ON "AgentPartner"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- Referral: access via parent AgentPartner ownership
ALTER TABLE "Referral" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "agents_own_referrals" ON "Referral"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "AgentPartner" ap
      JOIN "User" u ON u."id" = ap."userId"
      WHERE ap."id" = "agentId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "AgentPartner" ap
      JOIN "User" u ON u."id" = ap."userId"
      WHERE ap."id" = "agentId"
        AND u."supabaseAuthId" = auth.uid()::text
    )
  );

-- Platform admins can manage all referrals
CREATE POLICY "admins_all_referrals" ON "Referral"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- CorporateAccount: admin-only (corporate admins see their own)
ALTER TABLE "CorporateAccount" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_corporate_accounts" ON "CorporateAccount"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- Corporate admins can read their own account via tenantId
CREATE POLICY "corporate_admins_own_account" ON "CorporateAccount"
  FOR SELECT
  USING (
    "tenantId"::text IN (
      SELECT u."tenantId" FROM "User" u
      WHERE u."supabaseAuthId" = auth.uid()::text
        AND u.role = 'CORPORATE_ADMIN'
    )
  );

-- CorporateEmployee: admin-only + corporate admin of same tenant
ALTER TABLE "CorporateEmployee" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_only_corporate_employees" ON "CorporateEmployee"
  FOR ALL
  USING (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'))
  WITH CHECK (EXISTS (SELECT 1 FROM "User" WHERE "supabaseAuthId" = auth.uid()::text AND role = 'PLATFORM_ADMIN'));

-- Corporate admins can manage employees in their own corporate account
CREATE POLICY "corporate_admins_own_employees" ON "CorporateEmployee"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "CorporateAccount" ca
      JOIN "User" u ON u."tenantId" = ca."tenantId"::text
      WHERE ca."id" = "corporateId"
        AND u."supabaseAuthId" = auth.uid()::text
        AND u.role = 'CORPORATE_ADMIN'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "CorporateAccount" ca
      JOIN "User" u ON u."tenantId" = ca."tenantId"::text
      WHERE ca."id" = "corporateId"
        AND u."supabaseAuthId" = auth.uid()::text
        AND u.role = 'CORPORATE_ADMIN'
    )
  );

-- Corporate employees can read their own record
CREATE POLICY "employees_read_own_record" ON "CorporateEmployee"
  FOR SELECT
  USING (auth.uid()::text = (SELECT "supabaseAuthId" FROM "User" WHERE "id" = "userId"));

COMMIT;
