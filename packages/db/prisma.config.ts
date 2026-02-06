import path from "node:path";
import { defineConfig, env } from "prisma/config";
import dotenv from "dotenv";

// Load root .env file (two levels up from packages/db)
dotenv.config({ path: path.resolve(import.meta.dirname ?? ".", "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx src/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
