// Job Definitions & Types
// When BullMQ is added, these types drive the queue producers/consumers.

export type JobName =
  | "inventory.sync"
  | "notification.send"
  | "commission.calculate"
  | "delivery.remind"
  | "package.generate"
  | "cart.abandon-check";

export interface InventorySyncPayload {
  retailerId: string;
  configId: string;
  tier: "BASIC" | "PREMIUM";
}

export interface NotificationSendPayload {
  userId: string;
  type:
    | "ORDER_UPDATE"
    | "DELIVERY_UPDATE"
    | "PACKAGE_READY"
    | "PROMOTION"
    | "SYSTEM"
    | "SURVEY";
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface CommissionCalculatePayload {
  orderId: string;
}

export interface DeliveryRemindPayload {
  deliveryId: string;
}

export interface PackageGeneratePayload {
  packageId: string;
  projectId: string;
  userId: string;
  roomId?: string;
  styleTag?: string;
}

export interface CartAbandonCheckPayload {
  userId: string;
  cartId: string;
}

export type JobPayloadMap = {
  "inventory.sync": InventorySyncPayload;
  "notification.send": NotificationSendPayload;
  "commission.calculate": CommissionCalculatePayload;
  "delivery.remind": DeliveryRemindPayload;
  "package.generate": PackageGeneratePayload;
  "cart.abandon-check": CartAbandonCheckPayload;
};

export type JobHandler<T extends JobName> = (
  payload: JobPayloadMap[T],
) => Promise<void>;
