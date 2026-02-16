/**
 * Mixpanel analytics wrapper.
 *
 * Initializes Mixpanel using NEXT_PUBLIC_MIXPANEL_TOKEN.
 * When the token is not set, falls back to a no-op logger
 * (console.log in development, silent in production).
 */

import mixpanel from "mixpanel-browser";

import { env } from "~/env";

const MIXPANEL_TOKEN = env.NEXT_PUBLIC_MIXPANEL_TOKEN ?? "";
const IS_BROWSER = typeof window !== "undefined";
const IS_DEV = env.NODE_ENV === "development";

let initialized = false;

function ensureInitialized(): boolean {
  if (!IS_BROWSER) return false;
  if (initialized) return true;

  if (MIXPANEL_TOKEN) {
    mixpanel.init(MIXPANEL_TOKEN, {
      track_pageview: false,
      persistence: "localStorage",
    });
    initialized = true;
    return true;
  }

  return false;
}

/**
 * Track a page view event.
 */
export function trackPageView(pageName: string): void {
  if (ensureInitialized()) {
    mixpanel.track("Page Viewed", { page: pageName });
    return;
  }

  if (IS_DEV) {
    console.log(`[analytics] Page Viewed: ${pageName}`);
  }
}

/**
 * Track a user action with optional properties.
 */
export function trackAction(
  action: string,
  properties?: Record<string, unknown>,
): void {
  if (ensureInitialized()) {
    mixpanel.track(action, properties);
    return;
  }

  if (IS_DEV) {
    console.log(`[analytics] ${action}`, properties ?? "");
  }
}

/**
 * Identify a user for attribution.
 */
export function identifyUser(
  userId: string,
  traits?: Record<string, unknown>,
): void {
  if (ensureInitialized()) {
    mixpanel.identify(userId);
    if (traits) {
      mixpanel.people.set(traits);
    }
    return;
  }

  if (IS_DEV) {
    console.log(`[analytics] Identify: ${userId}`, traits ?? "");
  }
}
