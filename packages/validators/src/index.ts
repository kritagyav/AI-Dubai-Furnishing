import { z } from "zod/v4";

// Shared Zod validators used across the platform
// Add cross-cutting validation schemas here as the application grows

export const placeholder = z.string().describe("Validators package placeholder");
