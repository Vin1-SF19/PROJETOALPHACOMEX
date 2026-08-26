import "server-only";

import { NextResponse } from "next/server";
import { RoadmapProductionApiError } from "./auth";
import { RoadmapProductionOperationError } from "./operations";

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ success: true, data }, { status, headers: { "Cache-Control": "no-store" } });
}

export function handleRoadmapApiError(error: unknown) {
  if (error instanceof RoadmapProductionApiError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error instanceof RoadmapProductionOperationError) {
    return NextResponse.json(
      { success: false, error: error.message, code: error.code },
      { status: error.status, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (error && typeof error === "object" && "issues" in error) {
    return NextResponse.json(
      { success: false, error: "Payload inválido.", code: "VALIDATION_ERROR" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  console.error("[roadmap-production-api]", error);
  return NextResponse.json(
    { success: false, error: "Não foi possível concluir a operação.", code: "INTERNAL_ERROR" },
    { status: 500, headers: { "Cache-Control": "no-store" } },
  );
}
