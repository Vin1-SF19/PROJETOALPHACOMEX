import "server-only";

import {
  ROADMAP_API_READ_SCOPE,
  ROADMAP_API_WRITE_SCOPE,
  RoadmapProductionApiError,
  requireScope,
  resolveRoadmapApiIdentity,
  type RoadmapApiIdentity,
} from "@/lib/roadmap-production-api/auth";

export class RoadmapMcpAuthError extends Error {
  constructor(
    public readonly status: 401 | 403 | 429,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoadmapMcpAuthError";
  }
}

export async function resolveRoadmapMcpIdentity(
  request: Request,
): Promise<RoadmapApiIdentity> {
  try {
    const identity = await resolveRoadmapApiIdentity(request);
    requireScope(identity, ROADMAP_API_READ_SCOPE);
    return identity;
  } catch (error) {
    if (error instanceof RoadmapProductionApiError) {
      throw new RoadmapMcpAuthError(error.status, error.code, error.message);
    }
    throw new RoadmapMcpAuthError(
      401,
      "UNAUTHENTICATED",
      "Autentique-se no Painel Alpha ou envie uma credencial Bearer.",
    );
  }
}

export function requireRoadmapMcpWrite(identity: RoadmapApiIdentity): void {
  try {
    requireScope(identity, ROADMAP_API_WRITE_SCOPE);
  } catch (error) {
    if (error instanceof RoadmapProductionApiError) {
      throw new RoadmapMcpAuthError(error.status, error.code, error.message);
    }
    throw new RoadmapMcpAuthError(
      403,
      "WRITE_SCOPE_REQUIRED",
      `A operação exige o scope ${ROADMAP_API_WRITE_SCOPE}.`,
    );
  }
}
