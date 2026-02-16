"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

const statusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800",
  PAID: "bg-blue-100 text-blue-800",
  PROCESSING: "bg-indigo-100 text-indigo-800",
  SHIPPED: "bg-purple-100 text-purple-800",
  DELIVERED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
  REFUNDED: "bg-orange-100 text-orange-800",
};

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
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground mb-4">Order not found</p>
        <Button onClick={() => router.push("/orders")}>Back to Orders</Button>
      </div>
    );
  }

  const cancellable = ["DRAFT", "PENDING_PAYMENT", "PAID", "PROCESSING"].includes(
    order.status,
  );

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
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-800"}`}
        >
          {order.status.replace(/_/g, " ")}
        </span>
      </div>

      {/* Order Info */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Order Details</h2>
          <div className="text-sm space-y-1">
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
          <div className="rounded-lg border p-4">
            <h2 className="mb-2 font-semibold">Shipping Address</h2>
            <div className="text-sm space-y-1">
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
      <div className="rounded-lg border">
        <div className="border-b px-4 py-3">
          <h2 className="font-semibold">Items</h2>
        </div>
        <div className="divide-y">
          {order.lineItems.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-4">
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
        <div className="border-t bg-gray-50 p-4">
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
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-semibold">Payments</h2>
          <div className="space-y-2">
            {order.payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div>
                  <span className="font-medium">{p.method}</span>{" "}
                  <span className="text-muted-foreground">&middot; {p.status}</span>
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
