import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { prisma } from "@dubai/db";

export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "true";

  const health: Record<string, unknown> = {
    status: "ok",
    timestamp: new Date().toISOString(),
    // eslint-disable-next-line no-restricted-properties -- Health check reads version at runtime
    version: process.env.npm_package_version ?? "unknown",
    uptime: process.uptime(),
  };

  if (deep) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      health.database = "connected";
    } catch {
      health.status = "degraded";
      health.database = "disconnected";
      return NextResponse.json(health, { status: 503 });
    }
  }

  return NextResponse.json(health, { status: 200 });
}
