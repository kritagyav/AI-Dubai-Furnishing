// Job Definitions, Types & BullMQ Producer
import { Queue } from "bullmq";

// ─── Job Types ───

export type JobName =
  | "inventory.sync"
  | "notification.send"
  | "commission.calculate"
  | "delivery.remind"
  | "package.generate"
  | "cart.abandon-check"
  | "analytics.track";

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

export type AnalyticsEventName =
  | "order.created"
  | "order.paid"
  | "order.cancelled"
  | "order.refunded"
  | "package.generated"
  | "package.accepted"
  | "cart.item_added"
  | "cart.cleared"
  | "product.viewed"
  | "catalog.uploaded";

export interface AnalyticsTrackPayload {
  event: AnalyticsEventName;
  userId: string;
  properties: Record<string, unknown>;
  timestamp?: string;
}

export type JobPayloadMap = {
  "inventory.sync": InventorySyncPayload;
  "notification.send": NotificationSendPayload;
  "commission.calculate": CommissionCalculatePayload;
  "delivery.remind": DeliveryRemindPayload;
  "package.generate": PackageGeneratePayload;
  "cart.abandon-check": CartAbandonCheckPayload;
  "analytics.track": AnalyticsTrackPayload;
};

export type JobHandler<T extends JobName> = (
  payload: JobPayloadMap[T],
) => Promise<void>;

// ─── BullMQ Queue Producer ───

const QUEUE_NAME = "dubai-jobs";

let queueInstance: Queue | undefined;

function getRedisUrl(): string {
  return process.env.BULLMQ_REDIS_URL ?? "redis://localhost:6379";
}

function parseRedisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 6379,
    ...(parsed.password ? { password: parsed.password } : {}),
  };
}

/**
 * Get or create the shared BullMQ queue instance.
 */
export function getQueue(): Queue {
  if (!queueInstance) {
    queueInstance = new Queue(QUEUE_NAME, {
      connection: parseRedisConnection(getRedisUrl()),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    });
  }
  return queueInstance;
}

/**
 * Type-safe job enqueue. Use from API routers to dispatch async work.
 *
 * @example
 *   await enqueue("commission.calculate", { orderId: "abc" });
 */
export async function enqueue<T extends JobName>(
  name: T,
  payload: JobPayloadMap[T],
  opts?: { delay?: number; priority?: number },
): Promise<void> {
  const queue = getQueue();
  await queue.add(name, payload, {
    ...(opts?.delay ? { delay: opts.delay } : {}),
    ...(opts?.priority ? { priority: opts.priority } : {}),
  });
}

/**
 * Track an analytics event asynchronously via the job queue.
 * Fire-and-forget — failures are silently swallowed.
 */
export function trackEvent(
  event: AnalyticsEventName,
  userId: string,
  properties: Record<string, unknown>,
): void {
  void enqueue("analytics.track", {
    event,
    userId,
    properties,
    timestamp: new Date().toISOString(),
  }).catch(() => {
    // Analytics tracking should never break the request
  });
}

/**
 * Gracefully close the queue connection.
 */
export async function closeQueue(): Promise<void> {
  if (queueInstance) {
    await queueInstance.close();
    queueInstance = undefined;
  }
}

export { QUEUE_NAME };
