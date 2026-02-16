import type { Prisma } from "@dubai/db";
import type { OfflineSyncPayload } from "@dubai/queue";
import { prisma } from "@dubai/db";

import { logger } from "../logger";

/**
 * Offline Sync Job -- processes PENDING offline actions.
 *
 * Reads the OfflineAction record, parses the action type, replays the
 * appropriate operation, and marks the record as completed or failed.
 */
export async function handleOfflineSync(
  payload: OfflineSyncPayload,
): Promise<void> {
  const log = logger.child({
    job: "offline.sync",
    actionId: payload.actionId,
    userId: payload.userId,
  });
  log.info("Processing offline action");

  const action = await prisma.offlineAction.findUnique({
    where: { id: payload.actionId },
    select: {
      id: true,
      userId: true,
      action: true,
      payload: true,
      status: true,
    },
  });

  if (!action) {
    log.warn("Offline action not found, skipping");
    return;
  }

  if (action.status !== "pending") {
    log.info({ status: action.status }, "Action not pending, skipping");
    return;
  }

  try {
    const actionPayload = action.payload as Record<string, unknown>;

    switch (action.action) {
      case "add_to_cart":
        await processAddToCart(action.userId, actionPayload);
        break;

      case "update_preferences":
        await processUpdatePreferences(action.userId, actionPayload);
        break;

      case "create_room":
        await processCreateRoom(action.userId, actionPayload);
        break;

      default:
        log.warn({ actionType: action.action }, "Unknown action type");
        await markFailed(action.id, `Unknown action type: ${action.action}`);
        return;
    }

    await prisma.offlineAction.update({
      where: { id: action.id },
      data: {
        status: "completed",
        processedAt: new Date(),
      },
    });

    log.info("Offline action completed successfully");
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Unknown processing error";
    log.error({ err: message }, "Offline action failed");
    await markFailed(action.id, message);
  }
}

async function markFailed(actionId: string, errorMessage: string) {
  await prisma.offlineAction.update({
    where: { id: actionId },
    data: {
      status: "failed",
      errorMessage,
      processedAt: new Date(),
    },
  });
}

/**
 * Replay "add_to_cart" -- adds an item to the user's cart.
 * Expects payload: { productId: string, quantity: number, priceFils: number }
 */
async function processAddToCart(
  userId: string,
  payload: Record<string, unknown>,
) {
  const productId = payload.productId as string;
  const quantity = payload.quantity as number;
  const priceFils = payload.priceFils as number;

  if (!productId || !priceFils) {
    throw new Error("add_to_cart requires productId and priceFils");
  }

  // Upsert cart for user
  const cart = await prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    select: { id: true },
  });

  // Upsert cart item (increment quantity if already exists)
  const existing = await prisma.cartItem.findUnique({
    where: { cartId_productId: { cartId: cart.id, productId } },
    select: { id: true, quantity: true },
  });

  if (existing) {
    await prisma.cartItem.update({
      where: { id: existing.id },
      data: { quantity: existing.quantity + quantity },
    });
  } else {
    await prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId,
        quantity,
        priceFils,
      },
    });
  }
}

/**
 * Replay "update_preferences" -- updates the user's style/lifestyle preferences.
 * Expects payload: { projectId: string, ...preference fields }
 */
async function processUpdatePreferences(
  userId: string,
  payload: Record<string, unknown>,
) {
  const projectId = payload.projectId as string;
  if (!projectId) {
    throw new Error("update_preferences requires projectId");
  }

  const updateData: Record<
    string,
    Prisma.InputJsonValue | number | string | null
  > = {};

  if (payload.stylePreferences !== undefined) {
    updateData.stylePreferences =
      payload.stylePreferences as Prisma.InputJsonValue;
  }
  if (payload.budgetMinFils !== undefined) {
    updateData.budgetMinFils = payload.budgetMinFils as number;
  }
  if (payload.budgetMaxFils !== undefined) {
    updateData.budgetMaxFils = payload.budgetMaxFils as number;
  }
  if (payload.familySize !== undefined) {
    updateData.familySize = payload.familySize as number;
  }
  if (payload.hasPets !== undefined) {
    updateData.hasPets = payload.hasPets as boolean;
  }

  await prisma.userPreference.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: {
      userId,
      projectId,
      ...updateData,
    },
    update: updateData,
  });
}

/**
 * Replay "create_room" -- creates a new room within a project.
 * Expects payload: { projectId: string, name: string, type?: string }
 */
async function processCreateRoom(
  userId: string,
  payload: Record<string, unknown>,
) {
  const projectId = payload.projectId as string;
  const name = payload.name as string;

  if (!projectId || !name) {
    throw new Error("create_room requires projectId and name");
  }

  // Verify project ownership
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId },
    select: { id: true },
  });

  if (!project) {
    throw new Error("Project not found or not owned by user");
  }

  // Get the next order index
  const lastRoom = await prisma.room.findFirst({
    where: { projectId },
    orderBy: { orderIndex: "desc" },
    select: { orderIndex: true },
  });

  const roomType = payload.type as string;

  await prisma.room.create({
    data: {
      projectId,
      name,
      type: roomType as
        | "LIVING_ROOM"
        | "BEDROOM"
        | "DINING_ROOM"
        | "KITCHEN"
        | "BATHROOM"
        | "STUDY_OFFICE"
        | "BALCONY"
        | "OTHER",
      orderIndex: (lastRoom?.orderIndex ?? -1) + 1,
    },
  });
}
