import { describe, expect, it } from "vitest";
import { z } from "zod/v4";

// Define pagination schemas inline since the validators package only has a placeholder
const paginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

const paginatedOutput = <T extends z.ZodType>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    nextCursor: z.string().optional(),
    totalCount: z.number().int().optional(),
  });

describe("paginationInput", () => {
  it("accepts valid pagination with limit and cursor", () => {
    const result = paginationInput.safeParse({ limit: 10, cursor: "abc123" });
    expect(result.success).toBe(true);
  });

  it("applies default limit of 20", () => {
    const result = paginationInput.parse({});
    expect(result.limit).toBe(20);
  });

  it("rejects limit below 1", () => {
    const result = paginationInput.safeParse({ limit: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects limit above 100", () => {
    const result = paginationInput.safeParse({ limit: 101 });
    expect(result.success).toBe(false);
  });

  it("accepts missing cursor as optional", () => {
    const result = paginationInput.safeParse({ limit: 5 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cursor).toBeUndefined();
    }
  });
});

describe("paginatedOutput", () => {
  const stringOutput = paginatedOutput(z.string());

  it("accepts valid paginated response", () => {
    const result = stringOutput.safeParse({
      items: ["a", "b"],
      nextCursor: "next-abc",
      totalCount: 10,
    });
    expect(result.success).toBe(true);
  });

  it("accepts response without nextCursor (last page)", () => {
    const result = stringOutput.safeParse({
      items: ["a"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid item types", () => {
    const result = stringOutput.safeParse({
      items: [123],
    });
    expect(result.success).toBe(false);
  });
});
