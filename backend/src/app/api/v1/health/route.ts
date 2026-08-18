import { NextResponse } from "next/server";

const startedAt = new Date().toISOString();

export function GET() {
  return NextResponse.json(
    {
      service: "backend",
      status: "ok",
      version: "1.0.0",
      startedAt,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
