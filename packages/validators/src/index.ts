import { z } from "zod/v4";

// ═══════════════════════════════════════════
// Shared pagination
// ═══════════════════════════════════════════

export const paginationInput = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});

// ═══════════════════════════════════════════
// Room Intelligence — Stories 2.1–2.6
// ═══════════════════════════════════════════

export const roomTypeEnum = z.enum([
  "LIVING_ROOM",
  "BEDROOM",
  "DINING_ROOM",
  "KITCHEN",
  "BATHROOM",
  "STUDY_OFFICE",
  "BALCONY",
  "OTHER",
]);

export const dimensionUnitEnum = z.enum(["METRIC", "IMPERIAL"]);

export const createProjectInput = z.object({
  name: z.string().min(1, "Project name is required").max(200),
  address: z.string().max(500).optional(),
});

export const updateProjectInput = z.object({
  projectId: z.uuid(),
  name: z.string().min(1).max(200).optional(),
  address: z.string().max(500).nullable().optional(),
});

/** Dimensions stored as integers in centimeters. Range: 1–10000 cm (0.01–100 m). */
export const dimensionCm = z
  .number()
  .int("Dimensions must be whole numbers (centimeters)")
  .min(1, "Dimension must be at least 1 cm")
  .max(10000, "Dimension cannot exceed 100 m");

export const createRoomInput = z.object({
  projectId: z.uuid(),
  name: z.string().min(1, "Room name is required").max(100),
  type: roomTypeEnum.default("OTHER"),
  widthCm: dimensionCm.optional(),
  lengthCm: dimensionCm.optional(),
  heightCm: dimensionCm.optional(),
  displayUnit: dimensionUnitEnum.default("METRIC"),
});

export const updateRoomInput = z.object({
  roomId: z.uuid(),
  name: z.string().min(1).max(100).optional(),
  type: roomTypeEnum.optional(),
  widthCm: dimensionCm.nullable().optional(),
  lengthCm: dimensionCm.nullable().optional(),
  heightCm: dimensionCm.nullable().optional(),
  displayUnit: dimensionUnitEnum.optional(),
});

export const reorderRoomsInput = z.object({
  projectId: z.uuid(),
  roomIds: z.array(z.uuid()).min(1),
});

// ═══════════════════════════════════════════
// Room Photos — Story 2.3
// ═══════════════════════════════════════════

export const addRoomPhotoInput = z.object({
  roomId: z.uuid(),
  storageUrl: z.url(),
  thumbnailUrl: z.url().optional(),
  orderIndex: z.number().int().min(0).default(0),
});

export const deleteRoomPhotoInput = z.object({
  photoId: z.uuid(),
});

export const reorderPhotosInput = z.object({
  roomId: z.uuid(),
  photoIds: z.array(z.uuid()).min(1),
});

// ═══════════════════════════════════════════
// Floor Plan — Story 2.4
// ═══════════════════════════════════════════

export const uploadFloorPlanInput = z.object({
  projectId: z.uuid(),
  storageUrl: z.url(),
  thumbnailUrl: z.url().optional(),
});

// ═══════════════════════════════════════════
// Room Type — Story 2.6
// ═══════════════════════════════════════════

export const setRoomTypeInput = z.object({
  roomId: z.uuid(),
  type: roomTypeEnum,
  source: z.enum(["MANUAL", "AI_SUGGESTED", "AI_CONFIRMED"]).default("MANUAL"),
  confidence: z.number().min(0).max(1).optional(),
});

// ═══════════════════════════════════════════
// Retailer — Stories 5.1–5.2
// ═══════════════════════════════════════════

export const registerRetailerInput = z.object({
  companyName: z.string().min(1, "Company name is required").max(200),
  tradeLicenseNumber: z.string().min(1, "Trade license number is required").max(100),
  contactEmail: z.email("Invalid email address"),
  contactPhone: z.string().max(20).optional(),
  businessType: z.string().max(100).optional(),
  warehouseDetails: z.string().max(2000).optional(),
});

export const submitRetailerDocumentsInput = z.object({
  documentsUrl: z.url(),
});

export const retailerDecisionInput = z.object({
  retailerId: z.uuid(),
  decision: z.enum(["APPROVED", "REJECTED"]),
  reason: z.string().max(1000).optional(),
});

export const furnitureCategoryEnum = z.enum([
  "SOFA",
  "BED",
  "DINING_TABLE",
  "DINING_CHAIR",
  "DESK",
  "OFFICE_CHAIR",
  "WARDROBE",
  "DRESSER",
  "BOOKSHELF",
  "TV_UNIT",
  "COFFEE_TABLE",
  "SIDE_TABLE",
  "RUG",
  "CURTAIN",
  "LIGHTING",
  "MIRROR",
  "STORAGE",
  "OUTDOOR",
  "DECOR",
  "OTHER",
]);

export const productInput = z.object({
  name: z.string().min(1).max(200),
  sku: z.string().min(1).max(100),
  category: furnitureCategoryEnum,
  dimensions: z.object({
    widthCm: z.number().int().positive(),
    depthCm: z.number().int().positive(),
    heightCm: z.number().int().positive(),
  }),
  materials: z.array(z.string()).min(1),
  colors: z.array(z.string()).min(1),
  priceFils: z.number().int().positive("Price must be positive"),
  photos: z.array(z.url()).min(1, "At least one photo is required").max(10),
  stockQuantity: z.number().int().nonnegative(),
});

export const catalogIngestInput = z.object({
  products: z.array(productInput).min(1).max(1000),
});

export const updateProductInput = z.object({
  productId: z.uuid(),
  name: z.string().min(1).max(200).optional(),
  priceFils: z.number().int().positive().optional(),
  stockQuantity: z.number().int().nonnegative().optional(),
  photos: z.array(z.url()).min(1).max(10).optional(),
});
