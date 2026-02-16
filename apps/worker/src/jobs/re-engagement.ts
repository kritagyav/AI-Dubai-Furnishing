import type { Prisma } from "@dubai/db";
import { prisma } from "@dubai/db";
import type { ReEngagementProcessPayload } from "@dubai/queue";

import { logger } from "../logger";

const DEFAULT_BATCH_SIZE = 50;

/**
 * Step-specific notification content for the re-engagement sequence.
 * Step 0: "Come back" — 24h after cart abandonment
 * Step 1: "Items selling fast" — 48h after cart abandonment
 * Step 2: "Special discount" — 72h after cart abandonment (final)
 */
function getStepNotification(
  step: number,
  cartSnapshot: unknown,
): { title: string; body: string; data?: Record<string, unknown> } {
  switch (step) {
    case 0:
      return {
        title: "We miss you! Come back and complete your order",
        body: "You left some great items in your cart. They're waiting for you!",
      };
    case 1:
      return {
        title: "Items in your cart are selling fast!",
        body: "Don't miss out — other shoppers are eyeing the same pieces.",
        data: { cartSnapshot },
      };
    case 2:
      return {
        title: "Special discount just for you!",
        body: "Complete your order now and enjoy an exclusive discount on your cart items.",
      };
    default:
      return {
        title: "We'd love to have you back",
        body: "Check out what's new in our collection.",
      };
  }
}

/**
 * Re-Engagement Process Job — processes active re-engagement sequences
 * whose nextActionAt has arrived. Sends step-appropriate notifications
 * and advances the sequence through its steps.
 */
export async function handleReEngagement(
  payload: ReEngagementProcessPayload,
): Promise<void> {
  const batchSize = payload.batchSize ?? DEFAULT_BATCH_SIZE;
  const log = logger.child({ job: "re-engagement.process", batchSize });
  log.info("Processing re-engagement sequences");

  const now = new Date();

  const sequences = await prisma.reEngagementSequence.findMany({
    where: {
      status: "ACTIVE",
      nextActionAt: { lte: now },
    },
    take: batchSize,
    orderBy: { nextActionAt: "asc" },
  });

  if (sequences.length === 0) {
    log.info("No active sequences due for processing");
    return;
  }

  log.info({ count: sequences.length }, "Found sequences to process");

  let processed = 0;
  let errors = 0;

  for (const sequence of sequences) {
    const seqLog = log.child({
      sequenceId: sequence.id,
      userId: sequence.userId,
      currentStep: sequence.currentStep,
    });

    try {
      // Look up the most recent abandoned cart for this user to get the snapshot
      const abandonedCart = await prisma.abandonedCart.findFirst({
        where: { userId: sequence.userId },
        orderBy: { createdAt: "desc" },
        select: { cartSnapshot: true },
      });

      const notification = getStepNotification(
        sequence.currentStep,
        abandonedCart?.cartSnapshot ?? null,
      );

      // Create the notification
      await prisma.notification.create({
        data: {
          userId: sequence.userId,
          type: "PROMOTION",
          channel: "IN_APP",
          title: notification.title,
          body: notification.body,
          ...(notification.data
            ? { data: notification.data as Prisma.InputJsonValue }
            : {}),
          sentAt: new Date(),
        },
      });

      seqLog.info("Step notification sent");

      const nextStep = sequence.currentStep + 1;

      if (nextStep >= sequence.totalSteps) {
        // Sequence is complete
        await prisma.reEngagementSequence.update({
          where: { id: sequence.id },
          data: {
            currentStep: nextStep,
            status: "COMPLETED",
            completedAt: new Date(),
            nextActionAt: null,
          },
        });
        seqLog.info("Sequence completed");
      } else {
        // Advance to next step, schedule 24h from now
        await prisma.reEngagementSequence.update({
          where: { id: sequence.id },
          data: {
            currentStep: nextStep,
            nextActionAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
        seqLog.info({ nextStep }, "Sequence advanced to next step");
      }

      processed++;
    } catch (error) {
      errors++;
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      seqLog.error({ error: errorMessage }, "Failed to process sequence");
    }
  }

  log.info(
    { processed, errors, total: sequences.length },
    "Re-engagement processing complete",
  );
}
