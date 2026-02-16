"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";

import { Button } from "@dubai/ui/button";

import { trackPageView, trackAction } from "~/lib/analytics";
import { useTRPCClient } from "~/trpc/react";

type Step = "address" | "payment" | "confirmation";

// Checkout.com Frames types
declare global {
  interface Window {
    Frames: {
      init: (config: {
        publicKey: string;
        style?: Record<string, unknown>;
        localization?: Record<string, string>;
      }) => void;
      submitCard: () => Promise<{ token: string }>;
      addEventHandler: (
        event: string,
        handler: (event: { isValid: boolean; element: string }) => void,
      ) => void;
      Events: {
        CARD_VALIDATION_CHANGED: string;
        FRAME_VALIDATION_CHANGED: string;
        PAYMENT_METHOD_CHANGED: string;
      };
      isCardValid: () => boolean;
    };
  }
}

const CHECKOUT_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY ?? "";
const IS_DEV = !CHECKOUT_PUBLIC_KEY || CHECKOUT_PUBLIC_KEY === "pk_test_placeholder";

export default function CheckoutPage() {
  const client = useTRPCClient();
  const router = useRouter();

  useEffect(() => {
    trackPageView("Checkout Started");
  }, []);

  const [step, setStep] = useState<Step>("address");
  const [submitting, setSubmitting] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

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
  const [paymentMethod, setPaymentMethod] = useState<"CARD" | "BANK_TRANSFER">(
    "CARD",
  );
  const [cardValid, setCardValid] = useState(false);
  const framesInitialized = useRef(false);

  const initCheckoutFrames = useCallback(() => {
    if (
      framesInitialized.current ||
      IS_DEV ||
      typeof window === "undefined" ||
      !window.Frames
    )
      return;

    window.Frames.init({
      publicKey: CHECKOUT_PUBLIC_KEY,
      style: {
        base: {
          fontSize: "14px",
          color: "#1a1a1a",
        },
        focus: {
          color: "#1a1a1a",
        },
        valid: {
          color: "#16a34a",
        },
        invalid: {
          color: "#dc2626",
        },
        placeholder: {
          base: {
            color: "#9ca3af",
          },
        },
      },
    });

    window.Frames.addEventHandler(
      window.Frames.Events.CARD_VALIDATION_CHANGED,
      (event: { isValid: boolean }) => {
        setCardValid(event.isValid);
      },
    );

    framesInitialized.current = true;
  }, []);

  useEffect(() => {
    if (step === "payment" && paymentMethod === "CARD" && !IS_DEV) {
      // Frames script may already be loaded
      if (window.Frames) {
        initCheckoutFrames();
      }
    }
  }, [step, paymentMethod, initCheckoutFrames]);

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
    setPaymentError(null);

    try {
      let token: string;

      if (paymentMethod === "CARD" && !IS_DEV) {
        // Tokenize card with Checkout.com Frames
        const result = await window.Frames.submitCard();
        token = result.token;
      } else {
        // Dev fallback or bank transfer — use placeholder
        token = `tok_dev_${Date.now()}`;
      }

      await client.commerce.processPayment.mutate({
        orderId,
        method: paymentMethod,
        token,
      });
      trackAction("Payment Completed", { orderId, method: paymentMethod });
      setStep("confirmation");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Payment failed. Please try again.";
      setPaymentError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (step === "confirmation") {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-success-light)]">
          <span className="text-2xl text-[var(--color-success-default)]">&#10003;</span>
        </div>
        <h1 className="text-3xl font-bold">Order Confirmed!</h1>
        <p className="text-muted-foreground">
          Your order{" "}
          <span className="font-mono font-semibold">{orderRef}</span> has been
          placed successfully.
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

      {/* Checkout.com Frames SDK */}
      {!IS_DEV && step === "payment" && paymentMethod === "CARD" && (
        <Script
          src="https://cdn.checkout.com/js/framesv2.min.js"
          onLoad={initCheckoutFrames}
        />
      )}

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
        <div className="space-y-4 bg-card rounded-lg p-6 shadow-xs">
          <h2 className="text-lg font-semibold">Shipping Address</h2>

          <div>
            <label className="text-sm font-medium">Address Line 1 *</label>
            <input
              type="text"
              value={address.line1}
              onChange={(e) =>
                setAddress({ ...address, line1: e.target.value })
              }
              placeholder="Building name, street"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Address Line 2</label>
            <input
              type="text"
              value={address.line2}
              onChange={(e) =>
                setAddress({ ...address, line2: e.target.value })
              }
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
        <div className="space-y-4 bg-card rounded-lg p-6 shadow-xs">
          <h2 className="text-lg font-semibold">Payment Method</h2>
          <p className="text-muted-foreground text-sm">
            Order ref: <span className="font-mono">{orderRef}</span>
          </p>

          {IS_DEV && (
            <div className="rounded-md border border-[var(--color-warning-default)] bg-[var(--color-warning-light)] px-4 py-3 text-sm text-[var(--color-warning-dark)]">
              Development mode: payments are simulated. Set{" "}
              <code className="rounded bg-amber-100 px-1 font-mono text-xs">
                NEXT_PUBLIC_CHECKOUT_COM_PUBLIC_KEY
              </code>{" "}
              to enable real card input.
            </div>
          )}

          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50">
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
            <label className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50">
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

          {/* Checkout.com Card Input Frames */}
          {paymentMethod === "CARD" && !IS_DEV && (
            <div className="space-y-3 rounded-md border p-4">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Card Number
                </label>
                <div className="card-number-frame rounded-md border px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Expiry Date
                  </label>
                  <div className="expiry-date-frame rounded-md border px-3 py-2" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium">CVV</label>
                  <div className="cvv-frame rounded-md border px-3 py-2" />
                </div>
              </div>
            </div>
          )}

          {paymentError && (
            <div className="rounded-md border border-[var(--color-error-default)]/20 bg-[var(--color-error-light)] px-4 py-3 text-sm text-[var(--color-error-dark)]">
              {paymentError}
            </div>
          )}

          <Button
            className="w-full"
            disabled={
              submitting ||
              (paymentMethod === "CARD" && !IS_DEV && !cardValid)
            }
            onClick={handlePayment}
          >
            {submitting ? "Processing..." : "Confirm Payment"}
          </Button>
        </div>
      )}
    </div>
  );
}
