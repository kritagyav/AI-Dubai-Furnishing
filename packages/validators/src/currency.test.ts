import { test, fc } from "@fast-check/vitest";
import { describe, expect } from "vitest";

describe("currency fils validation", () => {
  test.prop([fc.integer({ min: 0, max: 100_000_00 })])(
    "fils are always non-negative integers",
    (fils: number) => {
      expect(Number.isInteger(fils)).toBe(true);
      expect(fils).toBeGreaterThanOrEqual(0);
    },
  );

  test.prop([fc.integer({ min: 1, max: 100_000_00 })])(
    "fils to AED conversion is always positive",
    (fils: number) => {
      const aed = fils / 100;
      expect(aed).toBeGreaterThan(0);
    },
  );

  test.prop([fc.integer({ min: 0, max: 100_000_00 })])(
    "AED to fils roundtrip is identity",
    (fils: number) => {
      const aed = fils / 100;
      const backToFils = Math.round(aed * 100);
      expect(backToFils).toBe(fils);
    },
  );
});
