"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@dubai/ui/button";

import { useTRPCClient } from "~/trpc/react";

type Step = "address" | "payment" | "confirmation";

export default function CheckoutPage() {
  const client = useTRPCClient();
  const router = useRouter();
  const [step, setStep] = useState<Step>("address");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);

  // Address form
  const [address, setAddress] = useState({
    line1: "",
    line2: "",
    city: "Dubai",
    emirate: "Dubai",
    postalCode: "",
    country: "AE",
  });
  const [notes, setNotes] = useState("");

  // Payment
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "BANK_TRANSFER">("CARD");

  async function handlePlaceOrder() {
    if (!address.line1) {
      alert("Please enter your address");
      return;
    }
    setSubmitting(true);
    try {
      const result = await client.commerce.createOrder.mutate({
        shippingAddress: address,
        notes: notes || undefined,
      });
      setOrderId(result.orderId);
      setOrderRef(result.orderRef);
      setStep("payment");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create order");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePayment() {
    if (!orderId) return;
    setSubmitting(true);
    try {
      await client.commerce.processPayment.mutate({
        orderId,
        method: paymentMethod,
        token: `tok_${Date.now()}`, // placeholder token (Checkout.com integration pending)
      });
      setStep("confirmation");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmation") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <span className="text-2xl text-green-600">&#10003;</span>
        </div>
        <h1 className="text-3xl font-bold">Order Confirmed!</h1>
        <p className="text-muted-foreground">
          Your order <span className="font-mono font-semibold">{orderRef}</span>{" "}
          has been placed successfully.
        </p>
        <div className="flex justify-center gap-3">
          <Button onClick={() => router.push(`/orders/${orderId}`)}>
            View Order
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Checkout</h1>

      {/* Step indicators */}
      <div className="flex items-center gap-4 text-sm">
        <span
          className={`rounded-full px-3 py-1 ${step === "address" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          1. Shipping Address
        </span>
        <span
          className={`rounded-full px-3 py-1 ${step === "payment" ? "bg-primary text-primary-foreground" : "bg-muted"}`}
        >
          2. Payment
        </span>
      </div>

      {step === "address" && (
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Shipping Address</h2>

          <div>
            <label className="text-sm font-medium">Address Line 1 *</label>
            <input
              type="text"
              value={address.line1}
              onChange={(e) => setAddress({ ...address, line1: e.target.value })}
              placeholder="Building name, street"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Address Line 2</label>
            <input
              type="text"
              value={address.line2}
              onChange={(e) => setAddress({ ...address, line2: e.target.value })}
              placeholder="Apartment, floor (optional)"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">City</label>
              <input
                type="text"
                value={address.city}
                onChange={(e) =>
                  setAddress({ ...address, city: e.target.value })
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Emirate</label>
              <select
                value={address.emirate}
                onChange={(e) =>
                  setAddress({ ...address, emirate: e.target.value })
                }
                className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              >
                <option value="Dubai">Dubai</option>
                <option value="Abu Dhabi">Abu Dhabi</option>
                <option value="Sharjah">Sharjah</option>
                <option value="Ajman">Ajman</option>
                <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                <option value="Fujairah">Fujairah</option>
                <option value="Umm Al Quwain">Umm Al Quwain</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Postal Code</label>
            <input
              type="text"
              value={address.postalCode}
              onChange={(e) =>
                setAddress({ ...address, postalCode: e.target.value })
              }
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Order Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Special delivery instructions (optional)"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              rows={3}
            />
          </div>

          <Button
            className="w-full"
            disabled={submitting || !address.line1}
            onClick={handlePlaceOrder}
          >
            {submitting ? "Placing order..." : "Place Order"}
          </Button>
        </div>
      )}

      {step === "payment" && (
        <div className="space-y-4 rounded-lg border p-6">
          <h2 className="text-lg font-semibold">Payment Method</h2>
          <p className="text-muted-foreground text-sm">
            Order ref: <span className="font-mono">{orderRef}</span>
          </p>

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-gray-50">
              <input
                type="radio"
                name="payment"
                value="CARD"
                checked={paymentMethod === "CARD"}
                onChange={() => setPaymentMethod("CARD")}
              />
              <div>
                <p className="font-medium">Credit / Debit Card</p>
                <p className="text-muted-foreground text-xs">
                  Visa, Mastercard, AMEX
                </p>
              </div>
            </label>
            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-gray-50">
              <input
                type="radio"
                name="payment"
                value="BANK_TRANSFER"
                checked={paymentMethod === "BANK_TRANSFER"}
                onChange={() => setPaymentMethod("BANK_TRANSFER")}
              />
              <div>
                <p className="font-medium">Bank Transfer</p>
                <p className="text-muted-foreground text-xs">
                  Pay via direct bank transfer
                </p>
              </div>
            </label>
          </div>

          <Button
            className="w-full"
            disabled={submitting}
            onClick={handlePayment}
          >
            {submitting ? "Processing..." : "Confirm Payment"}
          </Button>
        </div>
      )}
    </div>
  );
}
