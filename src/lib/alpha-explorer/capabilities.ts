import { isPathWithinPrefix, normalizeLogicalPath } from "@/lib/alpha-explorer/paths";

export const EXPLORER_CAPABILITIES = [
  "list",
  "read",
  "upload",
  "create_folder",
  "rename",
  "move",
  "delete",
  "restore",
  "manage_permissions",
] as const;

export type ExplorerCapability = (typeof EXPLORER_CAPABILITIES)[number];

export interface ExplorerGrant {
  prefix: string;
  capabilities: readonly ExplorerCapability[];
  source: "user" | "role" | "sector" | "group" | "ownership" | "admin";
  sourceId: string;
}
export interface ExplorerCapabilityDecision {
  allowed: boolean;
  normalizedPath: string;
  capability: ExplorerCapability;
  matchedGrant: ExplorerGrant | null;
  reason: "GRANTED" | "NO_MATCHING_GRANT";
}

/**
 * V1 uses additive allow-only grants. Missing, malformed or non-matching grants
 * never grant access; deny/precedence semantics are intentionally absent.
 */
export function evaluateExplorerCapability(
  grants: readonly ExplorerGrant[],
  pathInput: string,
  capability: ExplorerCapability,
): ExplorerCapabilityDecision {
  const normalizedPath = normalizeLogicalPath(pathInput);
  const matching = grants
    .filter((grant) => grant.capabilities.includes(capability))
    .filter((grant) => isPathWithinPrefix(normalizedPath, grant.prefix))
    .sort((left, right) => normalizeLogicalPath(right.prefix).length - normalizeLogicalPath(left.prefix).length)[0];

  return {
    allowed: Boolean(matching),
    normalizedPath,
    capability,
    matchedGrant: matching ?? null,
    reason: matching ? "GRANTED" : "NO_MATCHING_GRANT",
  };
}

export function userPrivatePrefix(userId: number): string {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid internal user ID");
  return `usuarios/${userId}`;
}
