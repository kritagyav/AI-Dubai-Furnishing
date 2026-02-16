/**
 * Bank Payout Service
 *
 * Wraps bank transfer API calls for settlement payouts.
 * Falls back to simulated responses when BANK_PAYOUT_API_KEY is not set.
 */

// ─── Types ───

export interface BankTransferParams {
  recipientIban: string;
  amount: number;
  currency: string;
  reference: string;
}

export interface BankTransferResult {
  transactionRef: string;
  status: "PENDING" | "PROCESSING";
}

export interface TransferStatusResult {
  transactionRef: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
}

// ─── Internal Helpers ───

function getApiKey(): string | undefined {
  // eslint-disable-next-line no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing -- bootstrap env read
  return process.env.BANK_PAYOUT_API_KEY || undefined;
}

function getApiUrl(): string | undefined {
  // eslint-disable-next-line no-restricted-properties, @typescript-eslint/prefer-nullish-coalescing -- bootstrap env read
  return process.env.BANK_PAYOUT_API_URL || undefined;
}

function isDevelopmentFallback(): boolean {
  const key = getApiKey();
  return !key || key === "";
}

// ─── In-memory store for dev simulation ───

const devTransfers = new Map<
  string,
  { status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" }
>();

// ─── PayoutService ───

export class PayoutService {
  /**
   * Initiate a bank transfer to a recipient IBAN.
   *
   * In development without BANK_PAYOUT_API_KEY, simulates the transfer
   * with console.log and an in-memory store.
   */
  async initiateBankTransfer(
    params: BankTransferParams,
  ): Promise<BankTransferResult> {
    if (isDevelopmentFallback()) {
      const transactionRef = `payout_sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

      console.log(`[payout-service] DEV: Simulating bank transfer`, {
        transactionRef,
        recipientIban: params.recipientIban,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
      });

      devTransfers.set(transactionRef, { status: "PROCESSING" });

      return {
        transactionRef,
        status: "PROCESSING",
      };
    }

    const apiUrl = getApiUrl();
    const apiKey = getApiKey();

    if (!apiUrl || !apiKey) {
      throw new Error("Bank payout API configuration is incomplete");
    }

    const response = await fetch(`${apiUrl}/transfers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient_iban: params.recipientIban,
        amount: params.amount,
        currency: params.currency,
        reference: params.reference,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Bank payout API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      transaction_ref: string;
      status: string;
    };

    return {
      transactionRef: data.transaction_ref,
      status: data.status === "PROCESSING" ? "PROCESSING" : "PENDING",
    };
  }

  /**
   * Check the current status of a bank transfer.
   *
   * In development, returns a simulated status that transitions
   * from PROCESSING to COMPLETED.
   */
  async checkTransferStatus(
    transactionRef: string,
  ): Promise<TransferStatusResult> {
    if (isDevelopmentFallback()) {
      const transfer = devTransfers.get(transactionRef);

      if (!transfer) {
        console.log(
          `[payout-service] DEV: Transfer ${transactionRef} not found, returning COMPLETED`,
        );
        return { transactionRef, status: "COMPLETED" };
      }

      // Simulate status progression: PROCESSING -> COMPLETED
      if (transfer.status === "PROCESSING") {
        transfer.status = "COMPLETED";
        devTransfers.set(transactionRef, transfer);
      }

      console.log(
        `[payout-service] DEV: Transfer ${transactionRef} status: ${transfer.status}`,
      );

      return {
        transactionRef,
        status: transfer.status,
      };
    }

    const apiUrl = getApiUrl();
    const apiKey = getApiKey();

    if (!apiUrl || !apiKey) {
      throw new Error("Bank payout API configuration is incomplete");
    }

    const response = await fetch(
      `${apiUrl}/transfers/${encodeURIComponent(transactionRef)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      },
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => "Unknown error");
      throw new Error(
        `Bank payout API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const data = (await response.json()) as {
      transaction_ref: string;
      status: string;
    };

    const statusMap: Record<string, TransferStatusResult["status"]> = {
      PENDING: "PENDING",
      PROCESSING: "PROCESSING",
      COMPLETED: "COMPLETED",
      FAILED: "FAILED",
    };

    return {
      transactionRef: data.transaction_ref,
      status: statusMap[data.status] ?? "PENDING",
    };
  }
}

/** Singleton payout service instance. */
export const payoutService = new PayoutService();
