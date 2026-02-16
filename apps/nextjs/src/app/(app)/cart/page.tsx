"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState, SkeletonScreen } from "@dubai/ui";
import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  priceFils: number;
}

export default function CartPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<CartItem[]>([]);
  const [totalFils, setTotalFils] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    void client.commerce.getCart
      .query()
      .then((cart) => {
        setItems(cart.items);
        setTotalFils(cart.totalFils);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [client]);

  async function updateQuantity(itemId: string, quantity: number) {
    setUpdating(itemId);
    try {
      await client.commerce.updateCartItem.mutate({ itemId, quantity });
      // Refresh cart
      const cart = await client.commerce.getCart.query();
      setItems(cart.items);
      setTotalFils(cart.totalFils);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setUpdating(null);
    }
  }

  async function removeItem(itemId: string) {
    setUpdating(itemId);
    try {
      await client.commerce.removeCartItem.mutate({ itemId });
      const cart = await client.commerce.getCart.query();
      setItems(cart.items);
      setTotalFils(cart.totalFils);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to remove");
    } finally {
      setUpdating(null);
    }
  }

  async function clearCart() {
    try {
      await client.commerce.clearCart.mutate();
      setItems([]);
      setTotalFils(0);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clear");
    }
  }

  if (loading) {
    return (
      <div className="py-20">
        <SkeletonScreen rows={3} />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <EmptyState
          title="Your cart is empty"
          description="Add items from your project packages or browse the gallery."
          actionLabel="Browse Projects"
          onAction={() => router.push("/projects")}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Shopping Cart</h1>
        <button
          onClick={clearCart}
          className="text-sm text-[var(--color-error-default)] hover:text-[var(--color-error-dark)]"
        >
          Clear cart
        </button>
      </div>

      <div className="bg-card divide-y rounded-lg shadow-xs">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-4">
            <div className="flex-1">
              <p className="font-medium">
                Product {item.productId.slice(0, 8)}
              </p>
              <p className="text-muted-foreground text-sm">
                AED {(item.priceFils / 100).toFixed(2)} each
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button
                  disabled={updating === item.id}
                  onClick={() =>
                    updateQuantity(item.id, Math.max(0, item.quantity - 1))
                  }
                  className="hover:bg-muted rounded border px-2 py-1 text-sm disabled:opacity-50"
                >
                  -
                </button>
                <span className="w-8 text-center text-sm">{item.quantity}</span>
                <button
                  disabled={updating === item.id}
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  className="hover:bg-muted rounded border px-2 py-1 text-sm disabled:opacity-50"
                >
                  +
                </button>
              </div>

              <p className="w-24 text-right font-medium">
                AED {((item.priceFils * item.quantity) / 100).toFixed(2)}
              </p>

              <button
                disabled={updating === item.id}
                onClick={() => removeItem(item.id)}
                className="text-sm text-[var(--color-error-default)] hover:text-[var(--color-error-dark)] disabled:opacity-50"
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Order Summary */}
      <div className="bg-card rounded-lg p-6 shadow-xs">
        <h2 className="mb-4 text-lg font-semibold">Order Summary</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span>AED {(totalFils / 100).toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery Fee</span>
            <span>AED 50.00</span>
          </div>
          <div className="flex justify-between border-t pt-2 text-base font-semibold">
            <span>Total</span>
            <span>AED {((totalFils + 5000) / 100).toFixed(2)}</span>
          </div>
        </div>
        <Button
          className="mt-4 w-full"
          onClick={() => router.push("/checkout")}
        >
          Proceed to Checkout
        </Button>
      </div>
    </div>
  );
}
