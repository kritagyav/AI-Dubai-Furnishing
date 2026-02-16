import path from "node:path";
import { defineConfig } from "prisma/config";
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
    // Use DATABASE_URL from env if available; fallback for prisma generate (which doesn't need a real DB)
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});
