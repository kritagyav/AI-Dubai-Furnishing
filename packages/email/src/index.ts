/**
 * Email Service Client — wraps Resend for transactional email delivery.
 *
 * Dev fallback: when RESEND_API_KEY is not set, emails are logged to
 * console instead of being sent. This allows local development without
 * requiring a Resend account.
 */
import { Resend } from "resend";

const DEFAULT_FROM = "Dubai Furnishing <noreply@dubaiplatform.ae>";

interface SendResult {
  success: boolean;
  id?: string;
  error?: string;
}

export class EmailClient {
  private resend: Resend | null;
  private from: string;
  private devMode: boolean;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM ?? DEFAULT_FROM;
    this.devMode = !apiKey;

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.resend = null;
      console.warn("[EmailClient] No RESEND_API_KEY set — running in dev mode (console-only)");
    }
  }

  /**
   * Send a single transactional email.
   */
  async sendTransactional(to: string, subject: string, html: string): Promise<SendResult> {
    if (this.devMode) {
      console.log("[EmailClient DEV] sendTransactional:", { to, subject, html: html.slice(0, 200) });
      return { success: true, id: `dev-${crypto.randomUUID()}` };
    }

    try {
      const result = await this.resend!.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, id: result.data?.id };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  /**
   * Send an order confirmation email with line items.
   */
  async sendOrderConfirmation(
    to: string,
    orderRef: string,
    items: Array<{ name: string; quantity: number; priceFils: number }>,
    totalAed: number,
  ): Promise<SendResult> {
    const itemsHtml = items
      .map(
        (item) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee;">${item.name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:center;">${item.quantity}</td>
            <td style="padding:8px;border-bottom:1px solid #eee;text-align:right;">AED ${(item.priceFils / 100).toFixed(2)}</td>
          </tr>`,
      )
      .join("");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;">Order Confirmed</h1>
        <p>Thank you for your order! Your reference number is <strong>${orderRef}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <thead>
            <tr style="background:#f5f5f5;">
              <th style="padding:8px;text-align:left;">Item</th>
              <th style="padding:8px;text-align:center;">Qty</th>
              <th style="padding:8px;text-align:right;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2" style="padding:8px;font-weight:bold;">Total</td>
              <td style="padding:8px;text-align:right;font-weight:bold;">AED ${totalAed.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        <p style="color:#666;">We will notify you when your items are ready for delivery.</p>
      </div>
    `;

    return this.sendTransactional(to, `Order Confirmed — ${orderRef}`, html);
  }

  /**
   * Send a password reset email.
   */
  async sendPasswordReset(to: string, resetUrl: string): Promise<SendResult> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;">Reset Your Password</h1>
        <p>We received a request to reset your password. Click the button below to choose a new password.</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${resetUrl}" style="background:#1a1a1a;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;display:inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color:#666;font-size:14px;">If you did not request a password reset, you can safely ignore this email. This link expires in 1 hour.</p>
        <p style="color:#999;font-size:12px;">If the button does not work, copy and paste this URL into your browser: ${resetUrl}</p>
      </div>
    `;

    return this.sendTransactional(to, "Reset Your Password", html);
  }

  /**
   * Send an email verification email.
   */
  async sendEmailVerification(to: string, verifyUrl: string): Promise<SendResult> {
    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;">Verify Your Email</h1>
        <p>Welcome to Dubai Furnishing! Please verify your email address to get started.</p>
        <div style="text-align:center;margin:30px 0;">
          <a href="${verifyUrl}" style="background:#1a1a1a;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;display:inline-block;">
            Verify Email
          </a>
        </div>
        <p style="color:#999;font-size:12px;">If the button does not work, copy and paste this URL into your browser: ${verifyUrl}</p>
      </div>
    `;

    return this.sendTransactional(to, "Verify Your Email Address", html);
  }

  /**
   * Send a re-engagement campaign email.
   *
   * @param step - The re-engagement step (e.g. 1 = gentle nudge, 2 = incentive, 3 = final)
   * @param cartItems - Optional cart items for abandoned-cart re-engagement
   */
  async sendReEngagement(
    to: string,
    userName: string,
    step: number,
    cartItems?: Array<{ name: string; priceFils: number }>,
  ): Promise<SendResult> {
    const greeting = userName ? `Hi ${userName}` : "Hi there";

    let bodyContent: string;
    let subject: string;

    switch (step) {
      case 1:
        subject = "We miss you!";
        bodyContent = `
          <p>${greeting}, it has been a while since you visited Dubai Furnishing.</p>
          <p>We have new arrivals and curated packages waiting for you. Come take a look!</p>
        `;
        break;
      case 2:
        subject = "A special offer just for you";
        bodyContent = `
          <p>${greeting}, we noticed you have not been back recently.</p>
          <p>As a thank-you for being a valued member, enjoy <strong>10% off</strong> your next purchase. Use code <strong>COMEBACK10</strong> at checkout.</p>
        `;
        break;
      case 3:
        subject = "Last chance — your exclusive offer expires soon";
        bodyContent = `
          <p>${greeting}, your exclusive offer is expiring soon.</p>
          <p>Do not miss your chance to save on beautifully curated furnishings for your home.</p>
        `;
        break;
      default:
        subject = "Come back to Dubai Furnishing";
        bodyContent = `<p>${greeting}, we would love to see you again at Dubai Furnishing.</p>`;
    }

    if (cartItems && cartItems.length > 0) {
      const cartHtml = cartItems
        .map(
          (item) =>
            `<li style="padding:4px 0;">${item.name} — AED ${(item.priceFils / 100).toFixed(2)}</li>`,
        )
        .join("");

      bodyContent += `
        <p style="margin-top:20px;"><strong>You left these items in your cart:</strong></p>
        <ul style="list-style:none;padding:0;">${cartHtml}</ul>
      `;
    }

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <h1 style="color:#1a1a1a;">${subject}</h1>
        ${bodyContent}
        <div style="text-align:center;margin:30px 0;">
          <a href="https://dubaiplatform.ae" style="background:#1a1a1a;color:#fff;padding:12px 32px;text-decoration:none;border-radius:6px;display:inline-block;">
            Visit Dubai Furnishing
          </a>
        </div>
      </div>
    `;

    return this.sendTransactional(to, subject, html);
  }
}

/** Singleton email client instance. */
export const emailClient = new EmailClient();
