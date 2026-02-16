import type { CommissionCalculatePayload } from "@dubai/queue";
import { prisma } from "@dubai/db";

import { logger } from "../logger";

/**
 * Commission Calculate Job — computes and records commissions
 * for each retailer involved in an order after payment capture.
 */
export async function handleCommissionCalculate(
  payload: CommissionCalculatePayload,
): Promise<void> {
  const log = logger.child({
    job: "commission.calculate",
    orderId: payload.orderId,
  });
  log.info("Calculating commissions");

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
    select: {
      id: true,
      orderRef: true,
      status: true,
      lineItems: {
        select: { retailerId: true, totalFils: true },
      },
    },
  });

  if (!order) {
    log.warn("Order not found, skipping");
    return;
  }

  if (order.status !== "PAID") {
    log.warn({ status: order.status }, "Order not in PAID status, skipping");
    return;
  }

  // Group line items by retailer
  const retailerTotals = new Map<string, number>();
  for (const li of order.lineItems) {
    retailerTotals.set(
      li.retailerId,
      (retailerTotals.get(li.retailerId) ?? 0) + li.totalFils,
    );
  }

  for (const [retailerId, total] of retailerTotals) {
    // Check if commission already exists for this order+retailer
    const existing = await prisma.commission.findFirst({
      where: { orderId: order.id, retailerId },
      select: { id: true },
    });

    if (existing) {
      log.info({ retailerId }, "Commission already exists, skipping");
      continue;
    }

    const retailer = await prisma.retailer.findUnique({
      where: { id: retailerId },
      select: { commissionRate: true },
    });

    const rateBps = retailer?.commissionRate ?? 1200;
    const commissionAmount = Math.round((total * rateBps) / 10000);

    await prisma.commission.create({
      data: {
        retailerId,
        orderId: order.id,
        orderRef: order.orderRef,
        amountFils: commissionAmount,
        rateBps,
        netAmountFils: total - commissionAmount,
        status: "PENDING",
      },
    });

    await prisma.ledgerEntry.create({
      data: {
        retailerId,
        type: "COMMISSION",
        amountFils: commissionAmount,
        referenceId: order.id,
        description: `Commission for order ${order.orderRef}`,
      },
    });

    log.info(
      { retailerId, commissionFils: commissionAmount },
      "Commission created",
    );
  }

  log.info("Commission calculation completed");
}
