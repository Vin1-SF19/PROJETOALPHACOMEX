import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { auth } from "../../../auth";
import { evaluateExplorerCapability, type ExplorerCapability } from "./capabilities";
import { ExplorerError } from "./errors";
import { createSupportId, writeExplorerLog } from "./observability";
import { resolveExplorerRequestOrigin } from "./request-origin";
import { normalizeLogicalPath } from "./paths";
import { readExplorerRuntimeFlags } from "./runtime";
import { resolveExplorerAuthorization } from "./authorization";

export async function requireExplorerAccess(path: string, capability: ExplorerCapability, write = false) {
  const identity = await requireExplorerIdentity(write);
  const normalizedPath = normalizeLogicalPath(path);
  const decision = evaluateExplorerCapability(identity.authorization.grants, normalizedPath, capability);
  if (!decision.allowed) {
    writeExplorerLog({ correlationId: createSupportId(), action: capability, result: "denied", userId: identity.userId, errorCode: "FORBIDDEN" });
    throw new ExplorerError("FORBIDDEN", 403, "Sem permissão");
  }
  return { ...identity, path: normalizedPath };
}

export async function requireExplorerIdentity(write = false) {
  const session = await auth();
  const userId = Number(session?.user?.id ?? 0);
  if (!session?.user?.id || !Number.isSafeInteger(userId) || userId <= 0) {
    throw new ExplorerError("UNAUTHENTICATED", 401, "Não autenticado");
  }
  const flags = readExplorerRuntimeFlags();
  if (!flags.enabled) throw new ExplorerError("MODULE_DISABLED", 404, "Módulo indisponível");
  if (write && !flags.writeEnabled) throw new ExplorerError("WRITES_DISABLED", 503, "Escrita temporariamente indisponível");

  const authorization = await resolveExplorerAuthorization(userId);
  if (!authorization.active || !authorization.moduleAllowed) {
    writeExplorerLog({ correlationId: createSupportId(), action: "module_access", result: "denied", userId, errorCode: "FORBIDDEN" });
    throw new ExplorerError("FORBIDDEN", 403, "Sem permissão");
  }
  return {
    userId,
    role: session.user.role ?? "",
    authenticatedAt: session.authenticatedAt,
    authorization,
    flags,
  };
}

export function assertExplorerMutationRequest(request: Request, allowedOrigins?: readonly string[]): string {
  const origin = resolveExplorerRequestOrigin(request, allowedOrigins);

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin") {
    throw new ExplorerError("CROSS_SITE_REQUEST", 403, "Requisição cross-site não permitida");
  }
  return origin;
}

export { resolveExplorerRequestOrigin } from "./request-origin";

export function explorerErrorResponse(error: unknown, action: string): NextResponse {
  const supportId = createSupportId();
  if (error instanceof ExplorerError) {
    writeExplorerLog({ correlationId: supportId, action, result: error.status < 500 ? "denied" : "failure", errorCode: error.code });
    return NextResponse.json({ success: false, error: error.message, code: error.code, supportId }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ success: false, error: "Entrada inválida", code: "VALIDATION_ERROR", supportId }, { status: 400 });
  }
  writeExplorerLog({ correlationId: supportId, action, result: "failure", errorCode: "INTERNAL_ERROR" });
  return NextResponse.json({ success: false, error: "Falha interna", code: "INTERNAL_ERROR", supportId }, { status: 500 });
}
