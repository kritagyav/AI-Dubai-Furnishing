/**
 * @dubai/stylelint-config
 *
 * Enforces design token usage and CSS logical properties.
 * - Blocks physical direction properties (margin-left, padding-right, etc.)
 * - Blocks hardcoded hex color values — must use var(--token) references
 * - Blocks text-align: left/right — must use start/end
 */

/** @type {import('stylelint').Config} */
export default {
  rules: {
    /* ── Block physical properties — require logical equivalents ── */
    "property-disallowed-list": [
      [
        "margin-left",
        "margin-right",
        "padding-left",
        "padding-right",
        "border-left",
        "border-right",
        "border-left-width",
        "border-right-width",
        "border-left-color",
        "border-right-color",
        "border-left-style",
        "border-right-style",
        "left",
        "right",
      ],
      {
        message:
          "Use CSS logical properties instead (e.g., margin-inline-start, padding-inline-end, inset-inline-start). See Story 1.4 AC #3.",
      },
    ],

    /* ── Block text-align: left/right — use start/end ── */
    "declaration-property-value-disallowed-list": [
      {
        "text-align": ["left", "right"],
      },
      {
        message:
          "Use text-align: start/end instead of left/right for RTL support.",
      },
    ],

    /* ── Block hardcoded hex colors — must use var() references ── */
    "color-no-hex": [
      true,
      {
        message:
          "Do not use hardcoded hex colors. Use design token CSS custom properties via var(--token-name) instead.",
      },
    ],
  },
};
