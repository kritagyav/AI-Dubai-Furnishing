import type { PrismaClient } from "@dubai/db";
import { Prisma } from "@dubai/db";

export interface AuditLogEntry {
  actorId: string;
  actorRole: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes?: Record<string, unknown> | undefined;
  correlationId?: string | undefined;
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
}

/**
 * Writes an audit log entry to the database.
 * Used for tracking admin and sensitive operations.
 */
export async function writeAuditLog(
  db: PrismaClient,
  entry: AuditLogEntry,
): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      changes: entry.changes
        ? (entry.changes as Prisma.InputJsonValue)
        : Prisma.JsonNull,
      correlationId: entry.correlationId ?? null,
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
