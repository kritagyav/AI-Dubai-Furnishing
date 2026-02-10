/**
 * WCAG 2.1 AA Contrast Validation
 *
 * Checks all semantic foreground/background pairings meet:
 * - 4.5:1 for normal text (< 18px or < 14px bold)
 * - 3:1 for large text (≥ 18px or ≥ 14px bold) and UI components
 */

// Hex color to relative luminance (WCAG 2.1 algorithm)
function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16) / 255,
    parseInt(clean.slice(2, 4), 16) / 255,
    parseInt(clean.slice(4, 6), 16) / 255,
  ];
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map(srgbToLinear) as [
    number,
    number,
    number,
  ];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface ContrastPair {
  name: string;
  fg: string;
  bg: string;
  minRatio: number; // 4.5 for normal text, 3 for large text / UI
  type: "normal-text" | "large-text" | "ui-component";
}

// Key semantic pairings to validate
const pairs: ContrastPair[] = [
  // Primary text on surfaces
  {
    name: "text-primary on surface-primary (neutral-900 on neutral-50)",
    fg: "#2C2926",
    bg: "#FAFAF7",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "text-secondary on surface-primary (neutral-600 on neutral-50)",
    fg: "#736D68",
    bg: "#FAFAF7",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "text-primary on surface-secondary (neutral-900 on neutral-100)",
    fg: "#2C2926",
    bg: "#F5F0EB",
    minRatio: 4.5,
    type: "normal-text",
  },

  // Interactive color (sage-400) on surfaces
  {
    name: "sage-400 on neutral-50 (interactive links)",
    fg: "#5C7A5C",
    bg: "#FAFAF7",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "sage-400 on neutral-100 (interactive on cards)",
    fg: "#5C7A5C",
    bg: "#F5F0EB",
    minRatio: 3,
    type: "large-text",
  },

  // CTA (terracotta-400) with text
  {
    name: "neutral-50 on terracotta-400 (CTA button text)",
    fg: "#FAFAF7",
    bg: "#C67D5B",
    minRatio: 3,
    type: "large-text",
  },
  {
    name: "neutral-50 on terracotta-500 (CTA hover text)",
    fg: "#FAFAF7",
    bg: "#9E5F3F",
    minRatio: 4.5,
    type: "normal-text",
  },

  // Data color (slate-400) on surfaces
  {
    name: "slate-400 on neutral-50 (data text)",
    fg: "#5E6B7A",
    bg: "#FAFAF7",
    minRatio: 4.5,
    type: "normal-text",
  },

  // Inverse text
  {
    name: "neutral-50 on neutral-900 (inverse text)",
    fg: "#FAFAF7",
    bg: "#2C2926",
    minRatio: 4.5,
    type: "normal-text",
  },

  // Feedback states
  {
    name: "success-dark on success-light",
    fg: "#3D6B3D",
    bg: "#E8F5E8",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "error-dark on error-light",
    fg: "#963F38",
    bg: "#FBEAE8",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "warning-dark on warning-light",
    fg: "#8D6124",
    bg: "#FDF3E4",
    minRatio: 4.5,
    type: "normal-text",
  },
  {
    name: "info-dark on info-light",
    fg: "#4A5563",
    bg: "#E8EDF2",
    minRatio: 4.5,
    type: "normal-text",
  },

  // UI component contrast (3:1 requirement — non-text UI elements)
  {
    name: "focus ring (sage-400) on surface-primary",
    fg: "#5C7A5C",
    bg: "#FAFAF7",
    minRatio: 3,
    type: "ui-component",
  },
];

let hasFailures = false;

console.log("WCAG 2.1 AA Contrast Validation\n");
console.log("─".repeat(80));

for (const pair of pairs) {
  const ratio = contrastRatio(pair.fg, pair.bg);
  const pass = ratio >= pair.minRatio;
  const status = pass ? "PASS" : "FAIL";
  const icon = pass ? "✅" : "❌";

  if (!pass) hasFailures = true;

  console.log(
    `${icon} ${status} ${ratio.toFixed(2)}:1 (min ${pair.minRatio}:1 ${pair.type}) — ${pair.name}`,
  );
}

console.log("─".repeat(80));

if (hasFailures) {
  console.error("\n❌ Some contrast pairs failed WCAG 2.1 AA requirements.");
  process.exit(1);
} else {
  console.log("\n✅ All contrast pairs meet WCAG 2.1 AA requirements.");
}
