import type { Prisma } from "@dubai/db";
import { prisma } from "@dubai/db";
import type { NotificationSendPayload } from "@dubai/queue";

import { logger } from "../logger";

/**
 * Notification Send Job — creates in-app notifications.
 * In production, this would also dispatch push notifications
 * and emails via third-party providers.
 */
export async function handleNotificationSend(
  payload: NotificationSendPayload,
): Promise<void> {
  const log = logger.child({ job: "notification.send", userId: payload.userId });
  log.info({ type: payload.type }, "Sending notification");

  await prisma.notification.create({
    data: {
      userId: payload.userId,
      type: payload.type,
      channel: "IN_APP",
      title: payload.title,
      body: payload.body,
      ...(payload.data
        ? { data: payload.data as Prisma.InputJsonValue }
        : {}),
      sentAt: new Date(),
    },
  });

  log.info("Notification created successfully");
}
