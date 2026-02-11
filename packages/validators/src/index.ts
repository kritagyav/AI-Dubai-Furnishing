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

// ═══════════════════════════════════════════
// Lifestyle Discovery — Stories 3.1–3.4
// ═══════════════════════════════════════════

export const profileTypeEnum = z.enum([
  "RELOCATOR",
  "AIRBNB_INVESTOR",
  "CORPORATE_RELOCATION",
  "PORTFOLIO_OWNER",
]);

export const stylePreferenceEnum = z.enum([
  "modern",
  "traditional",
  "minimalist",
  "eclectic",
  "scandinavian",
  "industrial",
  "bohemian",
  "coastal",
  "mid_century",
  "contemporary",
  "rustic",
  "luxury",
]);

export const safetyFeatureEnum = z.enum([
  "ANCHORED_FURNITURE",
  "ROUNDED_CORNERS",
  "NON_TOXIC_FINISHES",
  "STAIN_RESISTANT_FABRICS",
  "SAFETY_LOCKS",
  "SOFT_CLOSE_DRAWERS",
  "ANTI_TIP_STRAPS",
  "CORD_COVERS",
]);

/** Story 3.1: Save/update lifestyle quiz answers. Supports partial saves (auto-save). */
export const saveLifestyleQuizInput = z.object({
  projectId: z.uuid(),
  budgetMinFils: z.number().int().nonnegative().optional(),
  budgetMaxFils: z.number().int().nonnegative().optional(),
  familySize: z.number().int().min(1).max(20).optional(),
  childrenAges: z.array(z.number().int().min(0).max(18)).optional(),
  hasPets: z.boolean().optional(),
  petTypes: z.array(z.string().max(50)).max(10).optional(),
  stylePreferences: z.array(stylePreferenceEnum).min(1).max(5).optional(),
  quizStep: z.number().int().min(0).max(10).optional(),
  quizCompleted: z.boolean().optional(),
});

/** Story 3.2: Set profile type for a project. */
export const setProfileTypeInput = z.object({
  projectId: z.uuid(),
  profileType: profileTypeEnum,
});

/** Story 3.3: Save Airbnb investor-specific preferences. */
export const targetDemographicEnum = z.enum([
  "business_travelers",
  "families",
  "luxury_tourists",
  "budget_travelers",
  "couples",
  "digital_nomads",
]);

export const saveInvestorPreferencesInput = z.object({
  projectId: z.uuid(),
  targetDemographics: z.array(targetDemographicEnum).min(1).max(6),
  nightlyRateMinFils: z.number().int().nonnegative().optional(),
  nightlyRateMaxFils: z.number().int().nonnegative().optional(),
  occupancyTargetPct: z.number().int().min(0).max(100).optional(),
  investmentBudgetFils: z.number().int().nonnegative().optional(),
});

/** Story 3.4: Save child-safety requirements. */
export const saveChildSafetyInput = z.object({
  projectId: z.uuid(),
  youngestChildAge: z.number().int().min(0).max(18).optional(),
  safetyFeatures: z.array(safetyFeatureEnum).min(1),
  notes: z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════
// Inventory Sync — Story 5.3
// ═══════════════════════════════════════════

export const syncTierEnum = z.enum(["BASIC", "PREMIUM"]);

export const registerSyncConfigInput = z.object({
  tier: syncTierEnum,
  webhookUrl: z.url().optional(),
  pollingInterval: z.number().int().min(15).max(1440).optional(), // 15 min – 24 hrs
});

export const inventoryUpdateInput = z.object({
  updates: z
    .array(
      z.object({
        sku: z.string().min(1).max(100),
        stockQuantity: z.number().int().nonnegative(),
        priceFils: z.number().int().positive().optional(),
      }),
    )
    .min(1)
    .max(5000),
});

// ═══════════════════════════════════════════
// Commission & Settlement — Story 5.5
// ═══════════════════════════════════════════

export const commissionStatusEnum = z.enum([
  "PENDING",
  "CLEARED",
  "SETTLED",
  "DISPUTED",
]);

export const listCommissionsInput = paginationInput.extend({
  status: commissionStatusEnum.optional(),
  fromDate: z.iso.datetime().optional(),
  toDate: z.iso.datetime().optional(),
});

export const disputeCommissionInput = z.object({
  commissionId: z.uuid(),
  reason: z.string().min(1, "Reason is required").max(2000),
});

export const listSettlementsInput = paginationInput.extend({
  status: z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]).optional(),
});

// ═══════════════════════════════════════════
// Catalog Health — Story 5.6
// ═══════════════════════════════════════════

export const getCatalogHealthInput = z.object({
  retailerId: z.uuid().optional(), // admin can specify; retailer auto-scoped
});

export const listCatalogIssuesInput = paginationInput.extend({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  issueType: z
    .enum([
      "STALE_STOCK",
      "MISSING_FIELDS",
      "BROKEN_IMAGE",
      "PRICING_ANOMALY",
      "LOW_QUALITY_IMAGE",
      "DUPLICATE_SKU",
    ])
    .optional(),
  resolved: z.boolean().optional(),
});

// ═══════════════════════════════════════════
// Retailer Dashboard Metrics — Story 5.4
// ═══════════════════════════════════════════

export const timeRangeEnum = z.enum(["7d", "30d", "90d", "custom"]);

export const getDashboardMetricsInput = z.object({
  timeRange: timeRangeEnum.default("30d"),
  fromDate: z.iso.datetime().optional(),
  toDate: z.iso.datetime().optional(),
});
