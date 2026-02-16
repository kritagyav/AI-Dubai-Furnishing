import { prisma } from "@dubai/db";
import type { DeliveryRemindPayload } from "@dubai/queue";

import { logger } from "../logger";

/**
 * Delivery Reminder Job — sends notifications for upcoming deliveries.
 */
export async function handleDeliveryRemind(
  payload: DeliveryRemindPayload,
): Promise<void> {
  const log = logger.child({
    job: "delivery.remind",
    deliveryId: payload.deliveryId,
  });
  log.info("Processing delivery reminder");

  const delivery = await prisma.deliverySchedule.findUnique({
    where: { id: payload.deliveryId },
    select: {
      id: true,
      orderId: true,
      status: true,
      scheduledDate: true,
      scheduledSlot: true,
    },
  });

  if (!delivery || delivery.status !== "SCHEDULED") {
    log.warn("Delivery not found or not scheduled, skipping");
    return;
  }

  const order = await prisma.order.findUnique({
    where: { id: delivery.orderId },
    select: { userId: true },
  });

  if (!order) {
    log.warn("Order not found, skipping");
    return;
  }

  await prisma.notification.create({
    data: {
      userId: order.userId,
      type: "DELIVERY_UPDATE",
      channel: "IN_APP",
      title: "Upcoming Delivery",
      body: `Your delivery is scheduled for ${delivery.scheduledDate.toLocaleDateString()} (${delivery.scheduledSlot ?? "TBD"})`,
      data: {
        deliveryId: delivery.id,
        orderId: delivery.orderId,
      },
      sentAt: new Date(),
    },
  });

  log.info("Delivery reminder sent");
}
