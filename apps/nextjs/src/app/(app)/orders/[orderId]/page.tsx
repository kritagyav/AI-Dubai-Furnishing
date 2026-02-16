"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ErrorState, SkeletonScreen } from "@dubai/ui";
import { Button } from "@dubai/ui/button";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPCClient } from "~/trpc/react";

interface OrderDetail {
  id: string;
  orderRef: string;
  status: string;
  subtotalFils: number;
  deliveryFeeFils: number;
  totalFils: number;
  shippingAddress: Record<string, string> | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string;
  lineItems: {
    id: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPriceFils: number;
    totalFils: number;
  }[];
  payments: {
    id: string;
    method: string;
    status: string;
    amountFils: number;
    capturedAt: string | null;
  }[];
}

export default function OrderDetailPage() {
  const params = useParams();
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const orderId = params.orderId as string;

  useEffect(() => {
    void client.commerce.getOrder
      .query({ orderId })
      .then((data) => {
        setOrder(data as unknown as OrderDetail);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [client, orderId]);

  async function handleCancel() {
    if (!confirm("Are you sure you want to cancel this order?")) return;
    setCancelling(true);
    try {
      await client.commerce.cancelOrder.mutate({ orderId });
      // Refresh
      const data = await client.commerce.getOrder.query({ orderId });
      setOrder(data as unknown as OrderDetail);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Cancel failed");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) {
    return <SkeletonScreen rows={4} header />;
  }

  if (!order) {
    return (
      <ErrorState
        title="Order not found"
        message="This order doesn't exist or you don't have access."
        retryLabel="Back to Orders"
        onRetry={() => router.push("/orders")}
      />
    );
  }

  const cancellable = [
    "DRAFT",
    "PENDING_PAYMENT",
    "PAID",
    "PROCESSING",
  ].includes(order.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.push("/orders")}
            className="text-muted-foreground mb-1 text-sm hover:underline"
          >
            &larr; Back to orders
          </button>
          <h1 className="text-3xl font-bold">Order {order.orderRef}</h1>
        </div>
        <StatusBadge status={order.status} className="px-3 py-1 text-sm" />
      </div>

      {/* Order Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-card rounded-lg p-4 shadow-xs">
          <h2 className="mb-2 font-semibold">Order Details</h2>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-muted-foreground">Placed:</span>{" "}
              {new Date(order.createdAt).toLocaleString()}
            </p>
            {order.paidAt && (
              <p>
                <span className="text-muted-foreground">Paid:</span>{" "}
                {new Date(order.paidAt).toLocaleString()}
              </p>
            )}
            {order.notes && (
              <p>
                <span className="text-muted-foreground">Notes:</span>{" "}
                {order.notes}
              </p>
            )}
          </div>
        </div>

        {order.shippingAddress && (
          <div className="bg-card rounded-lg p-4 shadow-xs">
            <h2 className="mb-2 font-semibold">Shipping Address</h2>
            <div className="space-y-1 text-sm">
              <p>{order.shippingAddress.line1}</p>
              {order.shippingAddress.line2 && (
                <p>{order.shippingAddress.line2}</p>
              )}
              <p>
                {order.shippingAddress.city}, {order.shippingAddress.emirate}
              </p>
              {order.shippingAddress.postalCode && (
                <p>{order.shippingAddress.postalCode}</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="bg-card rounded-lg shadow-xs">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Items</h2>
        </div>
        <div className="divide-y">
          {order.lineItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-4"
            >
              <div>
                <p className="font-medium">{item.productName}</p>
                <p className="text-muted-foreground text-xs">
                  SKU: {item.sku} &middot; Qty: {item.quantity}
                </p>
              </div>
              <p className="font-medium">
                AED {(item.totalFils / 100).toFixed(2)}
              </p>
            </div>
          ))}
        </div>
        <div className="bg-muted/50 border-t p-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>AED {(order.subtotalFils / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Delivery Fee</span>
              <span>AED {(order.deliveryFeeFils / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-semibold">
              <span>Total</span>
              <span>AED {(order.totalFils / 100).toFixed(2)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Info */}
      {order.payments.length > 0 && (
        <div className="bg-card rounded-lg p-4 shadow-xs">
          <h2 className="mb-2 font-semibold">Payments</h2>
          <div className="space-y-2">
            {order.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between text-sm"
              >
                <div>
                  <span className="font-medium">{p.method}</span>{" "}
                  <span className="text-muted-foreground">
                    &middot; {p.status}
                  </span>
                </div>
                <span>AED {(p.amountFils / 100).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cancel */}
      {cancellable && (
        <div className="flex justify-end">
          <Button
            variant="destructive"
            disabled={cancelling}
            onClick={handleCancel}
          >
            {cancelling ? "Cancelling..." : "Cancel Order"}
          </Button>
        </div>
      )}
    </div>
  );
}
