// ═══════════════════════════════════════════════════════════════════════════
// @dubai/ai-client — AI Service Client for Furnishing Package Generation
// ═══════════════════════════════════════════════════════════════════════════

// ─── Type Definitions ────────────────────────────────────────────────────

/** Furniture categories matching the platform's FurnitureCategory enum. */
export type FurnitureCategory =
  | "SOFA"
  | "BED"
  | "DINING_TABLE"
  | "DINING_CHAIR"
  | "DESK"
  | "OFFICE_CHAIR"
  | "WARDROBE"
  | "DRESSER"
  | "BOOKSHELF"
  | "TV_UNIT"
  | "COFFEE_TABLE"
  | "SIDE_TABLE"
  | "RUG"
  | "CURTAIN"
  | "LIGHTING"
  | "MIRROR"
  | "STORAGE"
  | "OUTDOOR"
  | "DECOR"
  | "OTHER";

/** Style preference tags matching the platform's stylePreferenceEnum. */
export type StylePreference =
  | "modern"
  | "traditional"
  | "minimalist"
  | "eclectic"
  | "scandinavian"
  | "industrial"
  | "bohemian"
  | "coastal"
  | "mid_century"
  | "contemporary"
  | "rustic"
  | "luxury";

/** A product available for selection. */
export interface AvailableProduct {
  id: string;
  name: string;
  category: FurnitureCategory;
  priceFils: number;
  materials?: string[] | undefined;
  colors?: string[] | undefined;
  stockQuantity?: number | undefined;
}

/** Input for package recommendation requests. */
export interface PackageRecommendationInput {
  /** Minimum budget in fils (1/100 AED). */
  budgetMinFils?: number | undefined;
  /** Maximum budget in fils (1/100 AED). */
  budgetMaxFils: number;
  /** Style preferences (e.g. "modern", "minimalist"). */
  stylePreferences: string[];
  /** Optional room type hint (e.g. "living_room", "bedroom"). */
  roomType?: string | undefined;
  /** Optional specific style tag for the package. */
  styleTag?: string | undefined;
  /** Products available for selection. */
  availableProducts: AvailableProduct[];
  /** Maximum number of items to include. Defaults to 8. */
  maxItems?: number | undefined;
}

/** A single product selection within a recommendation. */
export interface SelectedProduct {
  productId: string;
  quantity: number;
  /** Why this product was selected. */
  reasoning: string;
}

/** Output from package recommendation. */
export interface PackageRecommendationOutput {
  selectedProducts: SelectedProduct[];
  totalPriceFils: number;
  /** Overall reasoning for the package composition. */
  packageReasoning: string;
  /** Whether the AI service was used or fallback logic ran. */
  source: "ai" | "fallback";
}

/** Input for style match scoring. */
export interface StyleMatchInput {
  productId: string;
  productName: string;
  productCategory: FurnitureCategory;
  productMaterials?: string[] | undefined;
  productColors?: string[] | undefined;
  styleTag: string;
}

/** Output from style match scoring. */
export interface StyleMatchOutput {
  productId: string;
  styleTag: string;
  /** Score from 0.0 (no match) to 1.0 (perfect match). */
  score: number;
  /** Brief explanation of the score. */
  reasoning: string;
  /** Whether the AI service was used or fallback logic ran. */
  source: "ai" | "fallback";
}

/** Output from room type classification. */
export interface RoomClassificationOutput {
  type: string;
  confidence: number;
  source: "ai" | "fallback";
}

/** Configuration options for the AI client. */
export interface AIClientConfig {
  /** AI service base URL. Defaults to AI_SERVICE_URL env var. */
  serviceUrl?: string | undefined;
  /** Request timeout in milliseconds. Defaults to 30000. */
  timeoutMs?: number | undefined;
  /** Number of retry attempts on transient failures. Defaults to 2. */
  maxRetries?: number | undefined;
  /** Base delay between retries in milliseconds (exponential backoff). Defaults to 1000. */
  retryDelayMs?: number | undefined;
}

/** Error thrown when the AI service returns an unexpected response. */
export class AIServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly responseBody?: string,
  ) {
    super(message);
    this.name = "AIServiceError";
  }
}

// ─── Prompt Templates ────────────────────────────────────────────────────

/**
 * System prompt for furnishing package curation.
 * Instructs the AI to act as an interior design curator for the Dubai market.
 */
export const PACKAGE_GENERATION_PROMPT = `You are an expert interior design curator specializing in Dubai residential furnishing.

Your task is to select the best combination of furniture products for a customer's room from the available inventory, considering their budget, style preferences, and room requirements.

Guidelines:
- Stay within the specified budget range. The total price of all selected items must not exceed the maximum budget.
- Prioritize category diversity: a well-furnished room needs items from different categories (seating, tables, storage, lighting, decor).
- Match the customer's style preferences. Consider materials, colors, and design aesthetics.
- Prefer products with higher stock availability to reduce fulfillment risk.
- For Dubai customers, consider climate-appropriate materials and culturally relevant design choices.
- Select practical quantities (e.g. 2 dining chairs, 1 sofa, 1 coffee table).
- Provide brief reasoning for each selection explaining why it fits the customer's needs.

Respond with valid JSON matching this schema:
{
  "selectedProducts": [
    { "productId": "string", "quantity": number, "reasoning": "string" }
  ],
  "packageReasoning": "string explaining the overall package composition"
}`;

/**
 * System prompt for style match scoring.
 * Instructs the AI to score how well a product matches a given style.
 */
export const STYLE_MATCHING_PROMPT = `You are an expert interior design consultant evaluating how well a furniture product matches a specific design style.

Score the product from 0.0 (no match) to 1.0 (perfect match) based on:
- Product category and typical style associations
- Material choices and their style connotations
- Color palette compatibility with the style
- Overall design aesthetic alignment

Respond with valid JSON matching this schema:
{
  "score": number,
  "reasoning": "string explaining the score"
}`;

/**
 * System prompt for room type classification from photos.
 * Instructs the AI to classify a room type from photo URLs.
 */
export const ROOM_CLASSIFICATION_PROMPT = `You are an expert interior design analyst. Given photo URLs of a room, classify the room type.

Possible room types:
- LIVING_ROOM
- BEDROOM
- DINING_ROOM
- KITCHEN
- BATHROOM
- STUDY_OFFICE
- BALCONY
- OTHER

Respond with valid JSON matching this schema:
{
  "type": "string (one of the room types above)",
  "confidence": number (0.0 to 1.0)
}`;

// ─── Style-Category Affinity Map (for fallback logic) ────────────────────

/**
 * Maps style preferences to categories that typically complement them.
 * Used by the fallback rule-based selection engine.
 */
const STYLE_CATEGORY_AFFINITY: Record<string, FurnitureCategory[]> = {
  modern: ["SOFA", "COFFEE_TABLE", "TV_UNIT", "LIGHTING", "RUG", "MIRROR"],
  traditional: ["SOFA", "DINING_TABLE", "DINING_CHAIR", "WARDROBE", "DRESSER", "CURTAIN", "RUG"],
  minimalist: ["SOFA", "BED", "DESK", "BOOKSHELF", "LIGHTING", "STORAGE"],
  eclectic: ["SOFA", "COFFEE_TABLE", "BOOKSHELF", "RUG", "DECOR", "LIGHTING", "MIRROR"],
  scandinavian: ["SOFA", "COFFEE_TABLE", "BOOKSHELF", "DESK", "RUG", "LIGHTING"],
  industrial: ["DESK", "OFFICE_CHAIR", "BOOKSHELF", "COFFEE_TABLE", "LIGHTING", "STORAGE"],
  bohemian: ["SOFA", "RUG", "CURTAIN", "DECOR", "LIGHTING", "SIDE_TABLE", "MIRROR"],
  coastal: ["SOFA", "COFFEE_TABLE", "SIDE_TABLE", "RUG", "DECOR", "LIGHTING", "MIRROR"],
  mid_century: ["SOFA", "COFFEE_TABLE", "SIDE_TABLE", "DESK", "BOOKSHELF", "LIGHTING"],
  contemporary: ["SOFA", "DINING_TABLE", "DINING_CHAIR", "TV_UNIT", "LIGHTING", "RUG"],
  rustic: ["DINING_TABLE", "DINING_CHAIR", "BOOKSHELF", "STORAGE", "RUG", "DECOR"],
  luxury: ["SOFA", "BED", "DINING_TABLE", "DINING_CHAIR", "WARDROBE", "DRESSER", "CURTAIN", "RUG", "LIGHTING", "MIRROR"],
};

/**
 * Maps style preferences to materials that typically complement them.
 * Used by the fallback style matching.
 */
const STYLE_MATERIAL_AFFINITY: Record<string, string[]> = {
  modern: ["metal", "glass", "leather", "chrome", "acrylic"],
  traditional: ["wood", "mahogany", "oak", "velvet", "silk", "brass"],
  minimalist: ["wood", "metal", "cotton", "linen", "concrete"],
  eclectic: ["wood", "metal", "fabric", "rattan", "ceramic"],
  scandinavian: ["wood", "birch", "pine", "wool", "cotton", "linen"],
  industrial: ["metal", "iron", "steel", "wood", "concrete", "leather"],
  bohemian: ["rattan", "jute", "cotton", "macrame", "bamboo", "fabric"],
  coastal: ["wood", "rattan", "linen", "cotton", "wicker", "bamboo"],
  mid_century: ["wood", "walnut", "teak", "leather", "fabric", "brass"],
  contemporary: ["metal", "glass", "leather", "fabric", "wood"],
  rustic: ["wood", "reclaimed wood", "iron", "stone", "burlap", "leather"],
  luxury: ["marble", "velvet", "silk", "gold", "brass", "leather", "crystal"],
};

/**
 * Maps room types to expected furniture categories.
 * Used to ensure appropriate category diversity.
 */
const ROOM_CATEGORY_MAP: Record<string, FurnitureCategory[]> = {
  living_room: ["SOFA", "COFFEE_TABLE", "TV_UNIT", "RUG", "CURTAIN", "LIGHTING", "SIDE_TABLE", "DECOR"],
  bedroom: ["BED", "WARDROBE", "DRESSER", "SIDE_TABLE", "CURTAIN", "RUG", "LIGHTING", "MIRROR"],
  dining_room: ["DINING_TABLE", "DINING_CHAIR", "STORAGE", "LIGHTING", "RUG", "DECOR"],
  office: ["DESK", "OFFICE_CHAIR", "BOOKSHELF", "STORAGE", "LIGHTING"],
  kitchen: ["STORAGE", "LIGHTING", "DECOR"],
  outdoor: ["OUTDOOR", "LIGHTING", "DECOR", "RUG"],
};

// ─── Fallback Rule-Based Selection ───────────────────────────────────────

/**
 * Computes a simple style match score based on category affinity and material overlap.
 * Returns a value between 0.0 and 1.0.
 */
function computeFallbackStyleScore(
  product: {
    category: FurnitureCategory;
    materials?: string[] | undefined;
    colors?: string[] | undefined;
  },
  styleTag: string,
): { score: number; reasoning: string } {
  let score = 0.3; // base score — any product has some baseline relevance
  const reasons: string[] = [];

  // Category affinity check
  const affinityCategories = STYLE_CATEGORY_AFFINITY[styleTag];
  if (affinityCategories?.includes(product.category)) {
    score += 0.35;
    reasons.push(`${product.category} is a common category for ${styleTag} style`);
  }

  // Material affinity check
  const affinityMaterials = STYLE_MATERIAL_AFFINITY[styleTag];
  if (affinityMaterials && product.materials) {
    const normalizedProductMaterials = product.materials.map((m) => m.toLowerCase());
    const matchingMaterials = affinityMaterials.filter((am) =>
      normalizedProductMaterials.some((pm) => pm.includes(am) || am.includes(pm)),
    );
    if (matchingMaterials.length > 0) {
      const materialBonus = Math.min(0.35, matchingMaterials.length * 0.12);
      score += materialBonus;
      reasons.push(`Materials (${matchingMaterials.join(", ")}) complement ${styleTag} style`);
    }
  }

  score = Math.min(1.0, score);

  return {
    score: Math.round(score * 100) / 100,
    reasoning: reasons.length > 0 ? reasons.join(". ") + "." : `Basic relevance for ${styleTag} style.`,
  };
}

/**
 * Rule-based package recommendation used when the AI service is unavailable.
 *
 * Strategy:
 * 1. Filter products within budget
 * 2. Determine target categories based on room type and style preferences
 * 3. Score and sort products by style affinity
 * 4. Greedily pick the best product from each target category
 * 5. Fill remaining slots with highest-scoring products from other categories
 */
function fallbackPackageRecommendation(
  input: PackageRecommendationInput,
): PackageRecommendationOutput {
  const maxItems = input.maxItems ?? 8;
  const budgetMax = input.budgetMaxFils;
  const budgetMin = input.budgetMinFils ?? 0;

  // Step 1: Filter by budget and availability
  const withinBudget = input.availableProducts.filter(
    (p) => p.priceFils <= budgetMax && (p.stockQuantity === undefined || p.stockQuantity > 0),
  );

  if (withinBudget.length === 0) {
    return {
      selectedProducts: [],
      totalPriceFils: 0,
      packageReasoning: "No products found within the specified budget range.",
      source: "fallback",
    };
  }

  // Step 2: Determine target categories
  let targetCategories: FurnitureCategory[] = [];

  // Add room-specific categories
  if (input.roomType) {
    const roomCats = ROOM_CATEGORY_MAP[input.roomType];
    if (roomCats) {
      targetCategories.push(...roomCats);
    }
  }

  // Add style-specific categories
  for (const style of input.stylePreferences) {
    const styleCats = STYLE_CATEGORY_AFFINITY[style];
    if (styleCats) {
      targetCategories.push(...styleCats);
    }
  }

  // Deduplicate; if no specific target categories, use all available
  targetCategories = [...new Set(targetCategories)];
  if (targetCategories.length === 0) {
    const availableCategories = [...new Set(withinBudget.map((p) => p.category))];
    targetCategories = availableCategories;
  }

  // Step 3: Score products by style affinity
  const primaryStyle = input.styleTag ?? input.stylePreferences[0] ?? "";
  const scored = withinBudget.map((product) => {
    let styleScore = 0;
    if (primaryStyle) {
      styleScore = computeFallbackStyleScore(product, primaryStyle).score;
    }
    // Boost for matching any of the user's style preferences
    for (const pref of input.stylePreferences) {
      if (pref !== primaryStyle) {
        styleScore += computeFallbackStyleScore(product, pref).score * 0.3;
      }
    }
    return { product, styleScore };
  });

  scored.sort((a, b) => b.styleScore - a.styleScore);

  // Step 4: Greedy category-diverse selection within budget
  const selected: SelectedProduct[] = [];
  const usedProductIds = new Set<string>();
  const usedCategories = new Set<FurnitureCategory>();
  let totalPrice = 0;

  // First pass: pick the best product from each target category
  for (const category of targetCategories) {
    if (selected.length >= maxItems) break;

    const candidate = scored.find(
      (s) =>
        s.product.category === category &&
        !usedProductIds.has(s.product.id) &&
        totalPrice + s.product.priceFils <= budgetMax,
    );

    if (candidate) {
      const { score, reasoning } = computeFallbackStyleScore(candidate.product, primaryStyle || "modern");
      selected.push({
        productId: candidate.product.id,
        quantity: 1,
        reasoning: reasoning || `Selected for category coverage (${category}).`,
      });
      usedProductIds.add(candidate.product.id);
      usedCategories.add(category);
      totalPrice += candidate.product.priceFils;
    }
  }

  // Second pass: fill remaining slots with highest-scoring unused products
  for (const entry of scored) {
    if (selected.length >= maxItems) break;
    if (usedProductIds.has(entry.product.id)) continue;
    if (totalPrice + entry.product.priceFils > budgetMax) continue;

    // Prefer categories not yet represented
    const categoryAlreadyCovered = usedCategories.has(entry.product.category);
    if (categoryAlreadyCovered && selected.length < maxItems - 1) {
      // Skip if we still have room and can potentially get a new category
      const hasUncoveredCategory = scored.some(
        (s) =>
          !usedProductIds.has(s.product.id) &&
          !usedCategories.has(s.product.category) &&
          totalPrice + s.product.priceFils <= budgetMax,
      );
      if (hasUncoveredCategory) continue;
    }

    const { reasoning } = computeFallbackStyleScore(entry.product, primaryStyle || "modern");
    selected.push({
      productId: entry.product.id,
      quantity: 1,
      reasoning,
    });
    usedProductIds.add(entry.product.id);
    usedCategories.add(entry.product.category);
    totalPrice += entry.product.priceFils;
  }

  // Check if we meet the minimum budget (try to add more items or increase quantities)
  if (totalPrice < budgetMin && selected.length > 0) {
    // Try to add more items
    for (const entry of scored) {
      if (usedProductIds.has(entry.product.id)) continue;
      if (totalPrice + entry.product.priceFils > budgetMax) continue;
      if (selected.length >= maxItems) break;

      selected.push({
        productId: entry.product.id,
        quantity: 1,
        reasoning: `Added to meet minimum budget target.`,
      });
      usedProductIds.add(entry.product.id);
      totalPrice += entry.product.priceFils;
    }
  }

  const categoriesList = [...usedCategories].join(", ");
  return {
    selectedProducts: selected,
    totalPriceFils: totalPrice,
    packageReasoning:
      `Rule-based selection: picked ${selected.length} items across ${usedCategories.size} categories (${categoriesList}). ` +
      `Total: ${totalPrice} fils. ` +
      (primaryStyle ? `Optimized for "${primaryStyle}" style preference.` : "No specific style applied."),
    source: "fallback",
  };
}

/**
 * Rule-based style match score used when the AI service is unavailable.
 */
function fallbackStyleMatch(input: StyleMatchInput): StyleMatchOutput {
  const { score, reasoning } = computeFallbackStyleScore(
    {
      category: input.productCategory,
      materials: input.productMaterials,
      colors: input.productColors,
    },
    input.styleTag,
  );

  return {
    productId: input.productId,
    styleTag: input.styleTag,
    score,
    reasoning,
    source: "fallback",
  };
}

// ─── Fallback Room Type Classification ────────────────────────────────────

/**
 * Keyword-based room type classification.
 * Attempts to match photo URLs or contextual hints to a room type.
 * Since we cannot actually inspect photo contents without the AI service,
 * this returns OTHER with low confidence as a default fallback.
 */
function fallbackRoomClassification(
  _photoUrls: string[],
): RoomClassificationOutput {
  return {
    type: "OTHER",
    confidence: 0.1,
    source: "fallback",
  };
}

/**
 * Heuristic room type classification based on a room name string.
 * Useful when AI service is unavailable and we have a room name to work with.
 */
export function classifyRoomTypeByName(name: string): RoomClassificationOutput {
  const lower = name.toLowerCase();

  const patterns: Array<{ keywords: string[]; type: string; confidence: number }> = [
    { keywords: ["living", "lounge", "family room", "sitting"], type: "LIVING_ROOM", confidence: 0.85 },
    { keywords: ["master bed", "bedroom", "guest room", "kids room", "nursery"], type: "BEDROOM", confidence: 0.85 },
    { keywords: ["dining", "eat-in"], type: "DINING_ROOM", confidence: 0.85 },
    { keywords: ["kitchen", "pantry", "kitchenette"], type: "KITCHEN", confidence: 0.85 },
    { keywords: ["bath", "shower", "toilet", "powder room", "washroom", "restroom"], type: "BATHROOM", confidence: 0.85 },
    { keywords: ["study", "office", "workspace", "den", "library"], type: "STUDY_OFFICE", confidence: 0.85 },
    { keywords: ["balcony", "terrace", "patio", "veranda", "deck"], type: "BALCONY", confidence: 0.85 },
  ];

  for (const pattern of patterns) {
    if (pattern.keywords.some((kw) => lower.includes(kw))) {
      return {
        type: pattern.type,
        confidence: pattern.confidence,
        source: "fallback",
      };
    }
  }

  return {
    type: "OTHER",
    confidence: 0.3,
    source: "fallback",
  };
}

// ─── AI Client Class ─────────────────────────────────────────────────────

/**
 * Client for the Dubai furnishing platform's AI service.
 *
 * Calls an external AI service for intelligent product recommendations and
 * style matching. Automatically falls back to rule-based logic when the
 * AI service is unavailable or not configured.
 *
 * @example
 * ```ts
 * const client = new AIClient();
 * const recommendation = await client.generatePackageRecommendation({
 *   budgetMaxFils: 500000,
 *   stylePreferences: ["modern", "minimalist"],
 *   availableProducts: products,
 * });
 * ```
 */
export class AIClient {
  private readonly serviceUrl: string | undefined;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(config?: AIClientConfig) {
    this.serviceUrl = config?.serviceUrl ?? process.env.AI_SERVICE_URL;
    this.timeoutMs = config?.timeoutMs ?? 30_000;
    this.maxRetries = config?.maxRetries ?? 2;
    this.retryDelayMs = config?.retryDelayMs ?? 1_000;
  }

  /**
   * Whether the AI service is configured (has a URL).
   * When not configured, all methods use fallback rule-based logic.
   */
  get isConfigured(): boolean {
    return !!this.serviceUrl;
  }

  /**
   * Generate a furnishing package recommendation.
   *
   * Calls the AI service to select the best products from available inventory
   * based on budget, style preferences, and room requirements.
   *
   * Falls back to rule-based selection when the AI service is unavailable.
   */
  async generatePackageRecommendation(
    input: PackageRecommendationInput,
  ): Promise<PackageRecommendationOutput> {
    if (!this.serviceUrl) {
      return fallbackPackageRecommendation(input);
    }

    try {
      const userMessage = JSON.stringify({
        budgetMinFils: input.budgetMinFils ?? 0,
        budgetMaxFils: input.budgetMaxFils,
        stylePreferences: input.stylePreferences,
        roomType: input.roomType ?? null,
        styleTag: input.styleTag ?? null,
        maxItems: input.maxItems ?? 8,
        products: input.availableProducts.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.category,
          priceFils: p.priceFils,
          materials: p.materials ?? [],
          colors: p.colors ?? [],
        })),
      });

      const response = await this.callService<{
        selectedProducts: SelectedProduct[];
        packageReasoning: string;
      }>("/v1/package-recommendation", {
        systemPrompt: PACKAGE_GENERATION_PROMPT,
        userMessage,
      });

      // Validate the AI response
      if (!Array.isArray(response.selectedProducts) || response.selectedProducts.length === 0) {
        throw new AIServiceError("AI returned empty or invalid product selection");
      }

      // Verify all selected product IDs exist in the input
      const availableIds = new Set(input.availableProducts.map((p) => p.id));
      const validSelections = response.selectedProducts.filter((s) => availableIds.has(s.productId));

      if (validSelections.length === 0) {
        throw new AIServiceError("AI returned product IDs not present in available products");
      }

      // Calculate total price from validated selections
      const totalPriceFils = validSelections.reduce((sum, sel) => {
        const product = input.availableProducts.find((p) => p.id === sel.productId);
        return sum + (product ? product.priceFils * sel.quantity : 0);
      }, 0);

      return {
        selectedProducts: validSelections.map((s) => ({
          productId: s.productId,
          quantity: s.quantity,
          reasoning: s.reasoning ?? "Selected by AI.",
        })),
        totalPriceFils,
        packageReasoning: response.packageReasoning ?? "AI-curated package.",
        source: "ai",
      };
    } catch (err) {
      // Fall back to rule-based on any AI service failure
      const result = fallbackPackageRecommendation(input);
      result.packageReasoning =
        `AI service unavailable (${err instanceof Error ? err.message : "unknown error"}), ` +
        `using rule-based fallback. ${result.packageReasoning}`;
      return result;
    }
  }

  /**
   * Score how well a product matches a given style tag.
   *
   * Falls back to rule-based scoring when the AI service is unavailable.
   */
  async getStyleMatch(productId: string, styleTag: string): Promise<StyleMatchOutput>;
  async getStyleMatch(input: StyleMatchInput): Promise<StyleMatchOutput>;
  async getStyleMatch(
    productIdOrInput: string | StyleMatchInput,
    styleTag?: string,
  ): Promise<StyleMatchOutput> {
    // Normalize overloaded signatures
    const input: StyleMatchInput =
      typeof productIdOrInput === "string"
        ? {
            productId: productIdOrInput,
            productName: "",
            productCategory: "OTHER",
            styleTag: styleTag!,
          }
        : productIdOrInput;

    if (!this.serviceUrl) {
      return fallbackStyleMatch(input);
    }

    try {
      const userMessage = JSON.stringify({
        productId: input.productId,
        productName: input.productName,
        productCategory: input.productCategory,
        materials: input.productMaterials ?? [],
        colors: input.productColors ?? [],
        styleTag: input.styleTag,
      });

      const response = await this.callService<{
        score: number;
        reasoning: string;
      }>("/v1/style-match", {
        systemPrompt: STYLE_MATCHING_PROMPT,
        userMessage,
      });

      // Validate score range
      const score = Math.max(0, Math.min(1, response.score ?? 0));

      return {
        productId: input.productId,
        styleTag: input.styleTag,
        score: Math.round(score * 100) / 100,
        reasoning: response.reasoning ?? "Scored by AI.",
        source: "ai",
      };
    } catch {
      // Fall back to rule-based scoring on any failure
      return fallbackStyleMatch(input);
    }
  }

  /**
   * Classify a room type from photo URLs.
   *
   * Calls the AI service to analyze room photos and determine the room type.
   * Falls back to a default classification when the AI service is unavailable.
   */
  async classifyRoomType(photoUrls: string[]): Promise<RoomClassificationOutput> {
    if (!this.serviceUrl) {
      return fallbackRoomClassification(photoUrls);
    }

    try {
      const userMessage = JSON.stringify({ photoUrls });

      const response = await this.callService<{
        type: string;
        confidence: number;
      }>("/v1/room-classification", {
        systemPrompt: ROOM_CLASSIFICATION_PROMPT,
        userMessage,
      });

      const validTypes = [
        "LIVING_ROOM", "BEDROOM", "DINING_ROOM", "KITCHEN",
        "BATHROOM", "STUDY_OFFICE", "BALCONY", "OTHER",
      ];

      const type = validTypes.includes(response.type) ? response.type : "OTHER";
      const confidence = Math.max(0, Math.min(1, response.confidence ?? 0.5));

      return {
        type,
        confidence: Math.round(confidence * 100) / 100,
        source: "ai",
      };
    } catch {
      return fallbackRoomClassification(photoUrls);
    }
  }

  // ─── Internal HTTP Helpers ─────────────────────────────────────────────

  /**
   * Make an HTTP request to the AI service with retry and timeout logic.
   */
  private async callService<T>(
    path: string,
    body: { systemPrompt: string; userMessage: string },
  ): Promise<T> {
    const url = `${this.serviceUrl}${path}`;

    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        // Exponential backoff: delay * 2^(attempt-1)
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1);
        await sleep(delay);
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        let response: Response;
        try {
          response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
        }

        if (!response.ok) {
          const responseBody = await response.text().catch(() => "<unreadable>");

          // Don't retry on client errors (4xx) except 429 (rate limit)
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new AIServiceError(
              `AI service returned ${response.status}: ${response.statusText}`,
              response.status,
              responseBody,
            );
          }

          // Retryable server error
          lastError = new AIServiceError(
            `AI service returned ${response.status}: ${response.statusText}`,
            response.status,
            responseBody,
          );
          continue;
        }

        const data = (await response.json()) as T;
        return data;
      } catch (err) {
        if (err instanceof AIServiceError && err.statusCode && err.statusCode >= 400 && err.statusCode < 500 && err.statusCode !== 429) {
          // Non-retryable client error
          throw err;
        }

        lastError =
          err instanceof Error
            ? err
            : new Error(String(err));

        // AbortError means timeout - retryable
        // Other network errors - retryable
      }
    }

    throw lastError ?? new Error("AI service request failed after all retries");
  }
}

// ─── Utilities ───────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Default Client Instance ─────────────────────────────────────────────

/**
 * Pre-configured singleton AI client using environment variables.
 * Import this for convenience or construct your own AIClient instance.
 */
export const aiClient = new AIClient();
