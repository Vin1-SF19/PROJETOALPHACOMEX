import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";

export type AlphaSeoMcpAuthKind = "session" | "api_key" | "oauth";

export interface AlphaSeoMcpIdentity {
  kind: AlphaSeoMcpAuthKind;
  userId: number;
  email: string;
  scopes: string[];
  fixedProjectId: string | null;
  credentialId: string | null;
}

export interface AlphaSeoMcpProjectContext extends AlphaSeoMcpIdentity {
  projectId: string;
  projectRole: "OWNER" | "EDITOR" | "VIEWER";
  project: {
    id: string;
    name: string;
    domain: string | null;
    locationCode: number;
    locationName: string | null;
    languageCode: string;
    market: string;
  };
}

export type AlphaSeoMcpToolSchema = z.ZodObject<z.ZodRawShape>;

export interface AlphaSeoMcpToolDefinition {
  name: string;
  title: string;
  description: string;
  inputSchema: AlphaSeoMcpToolSchema;
  outputSchema: AlphaSeoMcpToolSchema;
  annotations: ToolAnnotations;
  requiredRole?: "OWNER" | "EDITOR" | "VIEWER";
  execute: (
    args: Record<string, unknown>,
    identity: AlphaSeoMcpIdentity,
  ) => Promise<unknown>;
}

