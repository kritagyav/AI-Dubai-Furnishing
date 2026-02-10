import { describe, expect, it } from "vitest";

import {
  createProjectInput,
  createRoomInput,
  dimensionCm,
  updateProjectInput,
  updateRoomInput,
  productInput,
  catalogIngestInput,
  registerRetailerInput,
  paginationInput,
  setRoomTypeInput,
  addRoomPhotoInput,
  uploadFloorPlanInput,
  retailerDecisionInput,
} from "./index";

// ═══════════════════════════════════════════
// Pagination
// ═══════════════════════════════════════════

describe("paginationInput", () => {
  it("accepts valid pagination with defaults", () => {
    const result = paginationInput.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.limit).toBe(20);
    }
  });

  it("rejects limit over 100", () => {
    const result = paginationInput.safeParse({ limit: 200 });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// Project Validators
// ═══════════════════════════════════════════

describe("createProjectInput", () => {
  it("accepts valid project", () => {
    const result = createProjectInput.safeParse({
      name: "Marina Heights",
      address: "Dubai Marina, Tower 4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createProjectInput.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("allows missing address", () => {
    const result = createProjectInput.safeParse({ name: "Test" });
    expect(result.success).toBe(true);
  });
});

describe("updateProjectInput", () => {
  it("requires valid UUID", () => {
    const result = updateProjectInput.safeParse({
      projectId: "not-a-uuid",
      name: "New Name",
    });
    expect(result.success).toBe(false);
  });
});

// ═══════════════════════════════════════════
// Room Validators
// ═══════════════════════════════════════════

describe("dimensionCm", () => {
  it("accepts valid dimension", () => {
    expect(dimensionCm.safeParse(350).success).toBe(true);
  });

  it("rejects zero", () => {
    expect(dimensionCm.safeParse(0).success).toBe(false);
  });

  it("rejects negative", () => {
    expect(dimensionCm.safeParse(-10).success).toBe(false);
  });

  it("rejects over 10000 cm", () => {
    expect(dimensionCm.safeParse(10001).success).toBe(false);
  });

  it("rejects decimal (must be int)", () => {
    expect(dimensionCm.safeParse(350.5).success).toBe(false);
  });
});

describe("createRoomInput", () => {
  it("accepts valid room with dimensions", () => {
    const result = createRoomInput.safeParse({
      projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Master Bedroom",
      type: "BEDROOM",
      widthCm: 450,
      lengthCm: 500,
      heightCm: 280,
      displayUnit: "METRIC",
    });
    expect(result.success).toBe(true);
  });

  it("accepts room without dimensions", () => {
    const result = createRoomInput.safeParse({
      projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Kitchen",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid room type", () => {
    const result = createRoomInput.safeParse({
      projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      name: "Kitchen",
      type: "GARAGE",
    });
    expect(result.success).toBe(false);
  });
});

describe("setRoomTypeInput", () => {
  it("accepts manual type selection", () => {
    const result = setRoomTypeInput.safeParse({
      roomId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      type: "LIVING_ROOM",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.source).toBe("MANUAL");
    }
  });

  it("accepts AI suggested with confidence", () => {
    const result = setRoomTypeInput.safeParse({
      roomId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      type: "BEDROOM",
      source: "AI_SUGGESTED",
      confidence: 0.85,
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Photo Validators
// ═══════════════════════════════════════════

describe("addRoomPhotoInput", () => {
  it("accepts valid photo", () => {
    const result = addRoomPhotoInput.safeParse({
      roomId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      storageUrl: "https://storage.example.com/photo.jpg",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid URL", () => {
    const result = addRoomPhotoInput.safeParse({
      roomId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      storageUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });
});

describe("uploadFloorPlanInput", () => {
  it("accepts valid floor plan", () => {
    const result = uploadFloorPlanInput.safeParse({
      projectId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      storageUrl: "https://storage.example.com/plan.pdf",
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Retailer Validators
// ═══════════════════════════════════════════

describe("registerRetailerInput", () => {
  it("accepts valid registration", () => {
    const result = registerRetailerInput.safeParse({
      companyName: "Dubai Furniture Co.",
      tradeLicenseNumber: "DXB-123456",
      contactEmail: "info@dubai-furniture.ae",
      contactPhone: "+971501234567",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const result = registerRetailerInput.safeParse({
      companyName: "Test",
      tradeLicenseNumber: "DXB-123",
      contactEmail: "not-an-email",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing required fields", () => {
    const result = registerRetailerInput.safeParse({
      companyName: "Test",
    });
    expect(result.success).toBe(false);
  });
});

describe("retailerDecisionInput", () => {
  it("accepts approval", () => {
    const result = retailerDecisionInput.safeParse({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      decision: "APPROVED",
    });
    expect(result.success).toBe(true);
  });

  it("accepts rejection with reason", () => {
    const result = retailerDecisionInput.safeParse({
      retailerId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      decision: "REJECTED",
      reason: "Missing trade license documents",
    });
    expect(result.success).toBe(true);
  });
});

// ═══════════════════════════════════════════
// Product Validators
// ═══════════════════════════════════════════

describe("productInput", () => {
  const validProduct = {
    name: "Modern Sofa",
    sku: "SOFA-001",
    category: "SOFA" as const,
    dimensions: { widthCm: 200, depthCm: 90, heightCm: 80 },
    materials: ["leather", "wood"],
    colors: ["black", "brown"],
    priceFils: 299900,
    photos: ["https://cdn.example.com/sofa.jpg"],
    stockQuantity: 15,
  };

  it("accepts valid product", () => {
    expect(productInput.safeParse(validProduct).success).toBe(true);
  });

  it("rejects zero price", () => {
    expect(
      productInput.safeParse({ ...validProduct, priceFils: 0 }).success,
    ).toBe(false);
  });

  it("rejects negative price", () => {
    expect(
      productInput.safeParse({ ...validProduct, priceFils: -100 }).success,
    ).toBe(false);
  });

  it("rejects empty materials", () => {
    expect(
      productInput.safeParse({ ...validProduct, materials: [] }).success,
    ).toBe(false);
  });

  it("rejects empty photos", () => {
    expect(
      productInput.safeParse({ ...validProduct, photos: [] }).success,
    ).toBe(false);
  });

  it("rejects more than 10 photos", () => {
    const tooManyPhotos = Array.from(
      { length: 11 },
      (_, i) => `https://cdn.example.com/photo${i}.jpg`,
    );
    expect(
      productInput.safeParse({ ...validProduct, photos: tooManyPhotos }).success,
    ).toBe(false);
  });

  it("rejects negative stock quantity", () => {
    expect(
      productInput.safeParse({ ...validProduct, stockQuantity: -1 }).success,
    ).toBe(false);
  });

  it("allows zero stock quantity", () => {
    expect(
      productInput.safeParse({ ...validProduct, stockQuantity: 0 }).success,
    ).toBe(true);
  });
});

describe("catalogIngestInput", () => {
  it("rejects empty products array", () => {
    expect(catalogIngestInput.safeParse({ products: [] }).success).toBe(false);
  });

  it("rejects more than 1000 products", () => {
    const products = Array.from({ length: 1001 }, (_, i) => ({
      name: `Product ${i}`,
      sku: `SKU-${i}`,
      category: "SOFA",
      dimensions: { widthCm: 100, depthCm: 50, heightCm: 80 },
      materials: ["wood"],
      colors: ["white"],
      priceFils: 10000,
      photos: ["https://cdn.example.com/photo.jpg"],
      stockQuantity: 1,
    }));
    expect(catalogIngestInput.safeParse({ products }).success).toBe(false);
  });
});
