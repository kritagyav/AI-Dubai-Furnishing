"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, SkeletonScreen } from "@dubai/ui";

import { StatusBadge } from "~/components/StatusBadge";
import { useTRPCClient } from "~/trpc/react";

interface OrderSummary {
  id: string;
  orderRef: string;
  status: string;
  totalFils: number;
  createdAt: Date;
  _count: { lineItems: number };
}

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
    return <SkeletonScreen rows={3} message="Loading orders..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">My Orders</h1>
      </div>

      {orders.length === 0 ? (
        <EmptyState
          title="No orders yet"
          description="You haven't placed any orders yet."
          actionLabel="Start a Project"
          onAction={() => router.push("/projects")}
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {orders.map((order) => (
            <button
              key={order.id}
              onClick={() => router.push(`/orders/${order.id}`)}
              className="hover:bg-muted/50 flex w-full items-center justify-between p-4 text-left"
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
                <StatusBadge status={order.status} />
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
