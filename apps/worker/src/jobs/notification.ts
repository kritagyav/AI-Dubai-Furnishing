import type { Prisma } from "@dubai/db";
import type { NotificationSendPayload } from "@dubai/queue";
import { prisma } from "@dubai/db";
import { emailClient } from "@dubai/email";

import { logger } from "../logger";

/** Notification types that should also trigger an email. */
const EMAIL_NOTIFICATION_TYPES = new Set([
  "ORDER_UPDATE",
  "DELIVERY_UPDATE",
  "PACKAGE_READY",
]);

/**
 * Notification Send Job — creates in-app notifications and delivers
 * via email when appropriate.
 *
 * - IN_APP: always created as a DB record
 * - EMAIL: sent for ORDER_UPDATE, DELIVERY_UPDATE, PACKAGE_READY types
 * - PROMOTION type: sent as re-engagement email
 */
export async function handleNotificationSend(
  payload: NotificationSendPayload,
): Promise<void> {
  const log = logger.child({
    job: "notification.send",
    userId: payload.userId,
  });
  log.info({ type: payload.type }, "Sending notification");

  // Determine channel based on notification type
  const shouldSendEmail =
    EMAIL_NOTIFICATION_TYPES.has(payload.type) || payload.type === "PROMOTION";

  const channel = shouldSendEmail ? "EMAIL" : "IN_APP";

  // Create in-app notification record
  await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      channel,
      title: payload.title,
      body: payload.body,
      ...(payload.data ? { data: payload.data as Prisma.InputJsonValue } : {}),
      sentAt: new Date(),
    },
  });

  log.info("Notification created successfully");

  // Send email if appropriate
  if (shouldSendEmail) {
    try {
      // Look up user email
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
        select: { email: true, name: true },
      });

      if (!user) {
        log.warn("User not found for email delivery — skipping email");
        return;
      }

      if (payload.type === "PROMOTION") {
        // Send re-engagement email
        const step = (payload.data?.step as number | undefined) ?? 1;
        const cartItems = payload.data?.cartItems as
          | { name: string; priceFils: number }[]
          | undefined;

        const result = await emailClient.sendReEngagement(
          user.email,
          user.name ?? "",
          step,
          cartItems,
        );

        if (!result.success) {
          log.error(
            { error: result.error },
            "Failed to send re-engagement email",
          );
        } else {
          log.info({ emailId: result.id }, "Re-engagement email sent");
        }
      } else {
        // Send transactional email for order/delivery/package notifications
        const result = await emailClient.sendTransactional(
          user.email,
          payload.title,
          payload.body,
        );

        if (!result.success) {
          log.error(
            { error: result.error },
            "Failed to send transactional email",
          );
        } else {
          log.info({ emailId: result.id }, "Transactional email sent");
        }
      }
    } catch (err) {
      // Email delivery failure should not fail the job
      const message = err instanceof Error ? err.message : "Unknown error";
      log.error(
        { error: message },
        "Email delivery failed — notification record created but email not sent",
      );
    }
  }
}
