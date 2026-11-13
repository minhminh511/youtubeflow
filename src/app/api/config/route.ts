import { NextResponse } from "next/server";
import { getConfiguration } from "@/lib/config";

export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(getConfiguration(), { headers: { "Cache-Control": "no-store" } });
}
