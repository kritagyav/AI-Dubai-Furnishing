/**
 * Checkout.com Payment Service
 *
 * Wraps the Checkout.com Payments API for authorization, capture, and refund flows.
 * Falls back to simulated responses in development when CHECKOUT_COM_SECRET_KEY is not set.
 *
 * API docs: https://api-reference.checkout.com/#tag/Payments
 */

// ─── Error Types ───

export class PaymentError extends Error {
  constructor(
    message: string,
    public readonly code: PaymentErrorCode,
    public readonly httpStatus?: number,
    public readonly requestId?: string,
    public readonly errorCodes?: string[],
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

export type PaymentErrorCode =
  | "DECLINED"
  | "EXPIRED_CARD"
  | "INSUFFICIENT_FUNDS"
  | "INVALID_TOKEN"
  | "PROCESSING_ERROR"
  | "NETWORK_ERROR"
  | "NOT_FOUND"
  | "NOT_CAPTURABLE"
  | "NOT_REFUNDABLE"
  | "ALREADY_CAPTURED"
  | "ALREADY_REFUNDED";

// ─── Checkout.com API Response Types ───

export interface CheckoutPaymentSource {
  type: string;
  id?: string;
  scheme?: string;
  last4?: string;
  fingerprint?: string;
  bin?: string;
  card_type?: string;
  issuer_country?: string;
  expiry_month?: number;
  expiry_year?: number;
}

export interface CheckoutPaymentResponse {
  id: string;
  action_id: string;
  amount: number;
  currency: string;
  approved: boolean;
  status: "Authorized" | "Captured" | "Declined" | "Pending";
  response_code: string;
  response_summary?: string;
  source?: CheckoutPaymentSource;
  processed_on: string;
  reference?: string;
  _links?: Record<string, { href: string }>;
}

export interface CheckoutCaptureResponse {
  action_id: string;
  reference?: string;
}

export interface CheckoutRefundResponse {
  action_id: string;
  reference?: string;
}

export interface CheckoutErrorResponse {
  request_id?: string;
  error_type?: string;
  error_codes?: string[];
}

// ─── Service Input Types ───

export interface CreatePaymentIntentParams {
  amountFils: number;
  currency: string | undefined;
  token: string;
  reference: string;
  description: string | undefined;
  capture: boolean;
  method: "CARD" | "APPLE_PAY" | "GOOGLE_PAY" | "BANK_TRANSFER";
  customerEmail: string | undefined;
  customerName: string | undefined;
}

export interface PaymentIntentResult {
  externalId: string;
  actionId: string;
  approved: boolean;
  status: "Authorized" | "Captured" | "Declined" | "Pending";
  responseCode: string;
  responseSummary: string | undefined;
  processedOn: string;
}

export interface CaptureResult {
  actionId: string;
}

export interface RefundResult {
  actionId: string;
}

// ─── Constants ───

const CHECKOUT_API_BASE = "https://api.checkout.com";
const SANDBOX_API_BASE = "https://api.sandbox.checkout.com";

// ─── Internal Helpers ───

function getSecretKey(): string | undefined {
  return process.env.CHECKOUT_COM_SECRET_KEY ?? undefined;
}

function isDevelopmentFallback(): boolean {
  const key = getSecretKey();
  return !key || key === "" || key === "sk_test_placeholder";
}

function getApiBase(): string {
  const key = getSecretKey();
  if (key?.startsWith("sk_test_")) {
    return SANDBOX_API_BASE;
  }
  return CHECKOUT_API_BASE;
}

function mapTokenSourceType(
  method: CreatePaymentIntentParams["method"],
): string {
  switch (method) {
    case "APPLE_PAY":
      return "applepay";
    case "GOOGLE_PAY":
      return "googlepay";
    default:
      return "token";
  }
}

async function checkoutFetch<T>(
  path: string,
  options: {
    method: "GET" | "POST";
    body?: Record<string, unknown>;
  },
): Promise<T> {
  const secretKey = getSecretKey();
  if (!secretKey) {
    throw new PaymentError(
      "CHECKOUT_COM_SECRET_KEY is not configured",
      "PROCESSING_ERROR",
    );
  }

  const url = `${getApiBase()}${path}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${secretKey}`,
        "Content-Type": "application/json",
      },
      body: options.body ? JSON.stringify(options.body) : null,
    });
  } catch (err) {
    throw new PaymentError(
      `Network error calling Checkout.com: ${err instanceof Error ? err.message : String(err)}`,
      "NETWORK_ERROR",
    );
  }

  if (!response.ok) {
    let errorBody: CheckoutErrorResponse | undefined;
    try {
      errorBody = (await response.json()) as CheckoutErrorResponse;
    } catch {
      // Response body may not be JSON
    }

    const errorCode = mapHttpStatusToErrorCode(
      response.status,
      errorBody?.error_codes,
    );
    throw new PaymentError(
      errorBody?.error_type ??
        `Checkout.com API error: ${response.status} ${response.statusText}`,
      errorCode,
      response.status,
      errorBody?.request_id,
      errorBody?.error_codes,
    );
  }

  return (await response.json()) as T;
}

function mapHttpStatusToErrorCode(
  status: number,
  errorCodes?: string[],
): PaymentErrorCode {
  if (status === 404) return "NOT_FOUND";
  if (status === 422) {
    // Check specific Checkout.com error codes
    if (errorCodes?.includes("token_expired")) return "EXPIRED_CARD";
    if (errorCodes?.includes("token_invalid")) return "INVALID_TOKEN";
    if (errorCodes?.includes("card_expired")) return "EXPIRED_CARD";
    return "DECLINED";
  }
  if (status === 409) return "ALREADY_CAPTURED";
  return "PROCESSING_ERROR";
}

// ─── Dev Fallback Simulators ───

function simulatePaymentIntent(
  params: CreatePaymentIntentParams,
): PaymentIntentResult {
  const externalId = `pay_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  return {
    externalId,
    actionId: `act_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
    approved: true,
    status: params.capture ? "Captured" : "Authorized",
    responseCode: "10000",
    responseSummary: "Approved",
    processedOn: new Date().toISOString(),
  };
}

function simulateCapture(): CaptureResult {
  return {
    actionId: `act_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
  };
}

function simulateRefund(): RefundResult {
  return {
    actionId: `act_sim_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`,
  };
}

// ─── Public API ───

/**
 * Creates a payment via Checkout.com's POST /payments endpoint.
 *
 * In development without CHECKOUT_COM_SECRET_KEY, simulates a successful payment.
 *
 * @param params - Payment parameters including amount, token, and whether to capture immediately
 * @returns The payment result including the Checkout.com payment ID (externalId)
 */
export async function createPaymentIntent(
  params: CreatePaymentIntentParams,
): Promise<PaymentIntentResult> {
  if (isDevelopmentFallback()) {
    console.warn(
      "[payment-service] CHECKOUT_COM_SECRET_KEY not set — simulating payment success",
    );
    return simulatePaymentIntent(params);
  }

  const body: Record<string, unknown> = {
    source: {
      type: mapTokenSourceType(params.method),
      token: params.token,
    },
    amount: params.amountFils,
    currency: params.currency ?? "AED",
    reference: params.reference,
    capture: params.capture,
    description: params.description,
  };

  if (params.customerEmail || params.customerName) {
    body.customer = {
      ...(params.customerEmail ? { email: params.customerEmail } : {}),
      ...(params.customerName ? { name: params.customerName } : {}),
    };
  }

  const response = await checkoutFetch<CheckoutPaymentResponse>("/payments", {
    method: "POST",
    body,
  });

  if (!response.approved && response.status === "Declined") {
    throw new PaymentError(
      response.response_summary ?? "Payment declined",
      mapDeclineReason(response.response_code),
      undefined,
      undefined,
      [response.response_code],
    );
  }

  return {
    externalId: response.id,
    actionId: response.action_id,
    approved: response.approved,
    status: response.status,
    responseCode: response.response_code,
    responseSummary: response.response_summary,
    processedOn: response.processed_on,
  };
}

/**
 * Captures a previously authorized payment.
 *
 * @param paymentId - The Checkout.com payment ID (externalRef)
 * @param amountFils - Optional amount to capture (partial capture). If omitted, captures full amount.
 */
export async function capturePayment(
  paymentId: string,
  amountFils?: number,
): Promise<CaptureResult> {
  if (isDevelopmentFallback()) {
    console.warn(
      "[payment-service] CHECKOUT_COM_SECRET_KEY not set — simulating capture",
    );
    return simulateCapture();
  }

  const body: Record<string, unknown> = {};
  if (amountFils !== undefined) {
    body.amount = amountFils;
  }

  const response = await checkoutFetch<CheckoutCaptureResponse>(
    `/payments/${paymentId}/captures`,
    { method: "POST", body },
  );

  return { actionId: response.action_id };
}

/**
 * Initiates a refund on a captured payment.
 *
 * @param paymentId - The Checkout.com payment ID (externalRef)
 * @param amountFils - Optional amount to refund (partial refund). If omitted, refunds full amount.
 */
export async function refundPayment(
  paymentId: string,
  amountFils?: number,
): Promise<RefundResult> {
  if (isDevelopmentFallback()) {
    console.warn(
      "[payment-service] CHECKOUT_COM_SECRET_KEY not set — simulating refund",
    );
    return simulateRefund();
  }

  const body: Record<string, unknown> = {};
  if (amountFils !== undefined) {
    body.amount = amountFils;
  }

  const response = await checkoutFetch<CheckoutRefundResponse>(
    `/payments/${paymentId}/refunds`,
    { method: "POST", body },
  );

  return { actionId: response.action_id };
}

// ─── Helpers ───

function mapDeclineReason(responseCode: string): PaymentErrorCode {
  switch (responseCode) {
    case "20005":
    case "20051":
      return "INSUFFICIENT_FUNDS";
    case "20054":
      return "EXPIRED_CARD";
    case "20014":
    case "20087":
      return "INVALID_TOKEN";
    default:
      return "DECLINED";
  }
}
