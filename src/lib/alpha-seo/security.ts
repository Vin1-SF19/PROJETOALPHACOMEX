import { z } from "zod";

export const alphaSeoProjectRoleSchema = z.enum(["OWNER", "EDITOR", "VIEWER"]);
export type AlphaSeoProjectRole = z.infer<typeof alphaSeoProjectRoleSchema>;

export const alphaSeoProjectActionSchema = z.enum([
  "project:read",
  "project:update",
  "project:archive",
  "member:manage",
  "seo:read",
  "seo:execute",
  "seo:export",
]);
export type AlphaSeoProjectAction = z.infer<typeof alphaSeoProjectActionSchema>;

const ROLE_ACTIONS: Readonly<Record<AlphaSeoProjectRole, readonly AlphaSeoProjectAction[]>> = {
  OWNER: alphaSeoProjectActionSchema.options,
  EDITOR: ["project:read", "project:update", "seo:read", "seo:execute", "seo:export"],
  VIEWER: ["project:read", "seo:read", "seo:export"],
};

export function canProjectRole(role: AlphaSeoProjectRole, action: AlphaSeoProjectAction): boolean {
  return ROLE_ACTIONS[role].includes(action);
}

export interface AlphaSeoProjectAccessRecord {
  projectId: string;
  userId: string;
  role: AlphaSeoProjectRole;
  active: boolean;
}

export interface AlphaSeoProjectAccessRepository {
  findAccess(projectId: string, userId: string): Promise<AlphaSeoProjectAccessRecord | null>;
}

export async function authorizeProjectAccess(input: {
  repository: AlphaSeoProjectAccessRepository;
  projectId: string;
  userId: string;
  action: AlphaSeoProjectAction;
}): Promise<{ allowed: true; access: AlphaSeoProjectAccessRecord } | { allowed: false; reason: "NOT_FOUND" | "INACTIVE" | "FORBIDDEN" }> {
  const access = await input.repository.findAccess(input.projectId, input.userId);
  if (!access) return { allowed: false, reason: "NOT_FOUND" };
  if (!access.active) return { allowed: false, reason: "INACTIVE" };
  if (!canProjectRole(access.role, input.action)) return { allowed: false, reason: "FORBIDDEN" };
  return { allowed: true, access };
}

const SECRET_KEY_PATTERN = /(?:authorization|api[-_]?key|token|secret|password|cookie|ciphertext|private[-_]?key)/i;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const URL_SECRET_PATTERN = /([?&](?:code|state|token|key|secret)=)[^&#\s]+/gi;

export function redactString(value: string): string {
  return value.replace(BEARER_PATTERN, "Bearer [REDACTED]").replace(URL_SECRET_PATTERN, "$1[REDACTED]");
}

export function redactSecrets(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(redactSecrets);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nested]) => [
        key,
        SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactSecrets(nested),
      ]),
    );
  }
  return value;
}
