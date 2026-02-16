import { describe, expect, it } from "vitest";

import {
  addToCartInput,
  updateCartItemInput,
  removeCartItemInput,
  createOrderInput,
  processPaymentInput,
  cancelOrderInput,
  listOrdersInput,
} from "./index";

// ═══════════════════════════════════════════
// Cart Validators
// ═══════════════════════════════════════════

describe("addToCartInput", () => {
  it("accepts valid input with default quantity", () => {
    const result = addToCartInput.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.quantity).toBe(1);
    }
  });

  it("accepts valid input with explicit quantity", () => {
    const result = addToCartInput.safeParse({
      productId: "550e8400-e29b-41d4-a716-446655440000",
      quantity: 5,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    expect(
      addToCartInput.safeParse({ productId: "not-a-uuid" }).success,
    ).toBe(false);
  });

  it("rejects quantity of 0", () => {
    expect(
      addToCartInput.safeParse({
        productId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 0,
      }).success,
    ).toBe(false);
  });

  it("rejects quantity over 50", () => {
    expect(
      addToCartInput.safeParse({
        productId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: 51,
      }).success,
    ).toBe(false);
  });
});

describe("updateCartItemInput", () => {
  it("accepts valid update with quantity 0 (remove)", () => {
    const result = updateCartItemInput.safeParse({
      itemId: "550e8400-e29b-41d4-a716-446655440000",
      quantity: 0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative quantity", () => {
    expect(
      updateCartItemInput.safeParse({
        itemId: "550e8400-e29b-41d4-a716-446655440000",
        quantity: -1,
      }).success,
    ).toBe(false);
  });
});

describe("removeCartItemInput", () => {
  it("accepts valid UUID", () => {
    expect(
      removeCartItemInput.safeParse({
        itemId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Order Validators
// ═══════════════════════════════════════════

describe("createOrderInput", () => {
  const validAddress = {
    line1: "Marina Tower 5, Floor 12",
    city: "Dubai",
    emirate: "Dubai",
  };

  it("accepts valid order with minimal address", () => {
    const result = createOrderInput.safeParse({
      shippingAddress: validAddress,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.shippingAddress.country).toBe("AE");
    }
  });

  it("accepts valid order with full address and notes", () => {
    const result = createOrderInput.safeParse({
      shippingAddress: {
        ...validAddress,
        line2: "Apt 1204",
        postalCode: "12345",
        country: "AE",
      },
      notes: "Please call before delivery",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty address line1", () => {
    expect(
      createOrderInput.safeParse({
        shippingAddress: { ...validAddress, line1: "" },
      }).success,
    ).toBe(false);
  });

  it("rejects missing city", () => {
    expect(
      createOrderInput.safeParse({
        shippingAddress: { line1: "Test", emirate: "Dubai" },
      }).success,
    ).toBe(false);
  });

  it("rejects notes over 1000 characters", () => {
    expect(
      createOrderInput.safeParse({
        shippingAddress: validAddress,
        notes: "x".repeat(1001),
      }).success,
    ).toBe(false);
  });
});

describe("processPaymentInput", () => {
  it("accepts valid CARD payment", () => {
    const result = processPaymentInput.safeParse({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      method: "CARD",
      token: "tok_abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid BANK_TRANSFER payment", () => {
    const result = processPaymentInput.safeParse({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      method: "BANK_TRANSFER",
      token: "tok_bank_ref",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid payment method", () => {
    expect(
      processPaymentInput.safeParse({
        orderId: "550e8400-e29b-41d4-a716-446655440000",
        method: "CASH",
        token: "tok_123",
      }).success,
    ).toBe(false);
  });

  it("rejects empty token", () => {
    expect(
      processPaymentInput.safeParse({
        orderId: "550e8400-e29b-41d4-a716-446655440000",
        method: "CARD",
        token: "",
      }).success,
    ).toBe(false);
  });
});

describe("cancelOrderInput", () => {
  it("accepts valid cancellation without reason", () => {
    const result = cancelOrderInput.safeParse({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid cancellation with reason", () => {
    const result = cancelOrderInput.safeParse({
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      reason: "Changed my mind",
    });
    expect(result.success).toBe(true);
  });
});

describe("listOrdersInput", () => {
  it("accepts empty input with defaults", () => {
    const result = listOrdersInput.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("accepts status filter", () => {
    const result = listOrdersInput.safeParse({ status: "PAID" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    expect(
      listOrdersInput.safeParse({ status: "INVALID" }).success,
    ).toBe(false);
  });
});
