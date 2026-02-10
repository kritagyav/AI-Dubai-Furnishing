/// <reference lib="dom" />

/**
 * Test keyboard navigation by tabbing through elements and verifying focus order.
 * @param container The container element to test within
 * @param expectedFocusOrder Array of data-testid or aria-label values in expected tab order
 */
export function testKeyboardNavigation(
  container: HTMLElement,
  expectedFocusOrder: string[],
): void {
  const focusableSelector =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  const focusableElements = Array.from(
    container.querySelectorAll<HTMLElement>(focusableSelector),
  );

  for (let i = 0; i < expectedFocusOrder.length; i++) {
    const expected = expectedFocusOrder[i];
    const element = focusableElements[i];

    if (!element) {
      throw new Error(
        `Expected focusable element at index ${i} with identifier "${expected}", but none found`,
      );
    }

    element.focus();

    const testId = element.getAttribute("data-testid");
    const ariaLabel = element.getAttribute("aria-label");
    const identifier = testId ?? ariaLabel ?? element.textContent.trim();

    if (identifier !== expected) {
      throw new Error(
        `Focus order mismatch at index ${i}: expected "${expected}", got "${identifier}"`,
      );
    }
  }
}
