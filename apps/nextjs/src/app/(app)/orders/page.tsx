"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

interface OrderSummary {
  id: string;
  orderRef: string;
  status: string;
  totalFils: number;
  createdAt: Date;
  _count: { lineItems: number };
}

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

export default function OrdersPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderSummary[]>([]);

  useEffect(() => {
    void client.commerce.listOrders
      .query({ limit: 50 })
      .then((data) => {
        setOrders(data.items as OrderSummary[]);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [client]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground text-sm">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <div className="rounded-lg border p-12 text-center">
          <p className="text-muted-foreground mb-4">
            You haven&apos;t placed any orders yet
          </p>
          <Button onClick={() => router.push("/projects")}>
            Start a Project
          </Button>
        </div>
      ) : (
        <div className="divide-y rounded-lg border">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="flex w-full items-center justify-between p-4 text-left hover:bg-gray-50"
            >
              <div>
                <p className="font-mono text-sm font-semibold">
                  {order.orderRef}
                </p>
                <p className="text-muted-foreground text-xs">
                  {order._count.lineItems} items &middot;{" "}
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColors[order.status] ?? "bg-gray-100 text-gray-800"}`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
                <span className="font-medium">
                  AED {(order.totalFils / 100).toFixed(2)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
