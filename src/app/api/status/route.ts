import { NextResponse } from "next/server";
import { getPublicStatus } from "@/lib/server/config";

export const dynamic = "force-dynamic";

/** Informa ao cliente se a IA está configurada — nunca expõe chaves. */
export function GET() {
  return NextResponse.json(getPublicStatus(), { headers: { "Cache-Control": "no-store" } });
}
