import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";

function isMcpAuthError(error: unknown): error is Error & { code: string; status: number } {
  return error instanceof Error && error.name === "AlphaSeoMcpAuthError" && typeof (error as { code?: unknown }).code === "string";
}

export const MCP_CHARACTER_LIMIT = 25_000;

function jsonSafe(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function shrink(value: unknown): { value: unknown; omitted: number } {
  if (Array.isArray(value)) {
    const keep = Math.max(1, Math.floor(value.length / 2));
    return { value: value.slice(0, keep), omitted: value.length - keep };
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    for (const [key, nested] of Object.entries(source)) {
      if (Array.isArray(nested) && nested.length > 1) {
        const keep = Math.max(1, Math.floor(nested.length / 2));
        return {
          value: { ...source, [key]: nested.slice(0, keep) },
          omitted: nested.length - keep,
        };
      }
    }
  }
  const raw = JSON.stringify(value);
  return { value: { preview: raw.slice(0, MCP_CHARACTER_LIMIT - 1_000) }, omitted: Math.max(0, raw.length - MCP_CHARACTER_LIMIT + 1_000) };
}

export function mcpSuccess(value: unknown, summary?: string): CallToolResult {
  let structured = jsonSafe(value) as Record<string, unknown>;
  let text = JSON.stringify(structured, null, 2);
  let truncated = false;
  let omitted = 0;
  while (text.length > MCP_CHARACTER_LIMIT) {
    const reduced = shrink(structured);
    structured = reduced.value as Record<string, unknown>;
    omitted += reduced.omitted;
    truncated = true;
    text = JSON.stringify(structured, null, 2);
    if (reduced.omitted === 0) break;
  }
  if (truncated) {
    structured = {
      ...structured,
      truncated: true,
      omitted,
      truncationMessage: "Resposta limitada a 25.000 caracteres. Use limit/page/filtros para continuar.",
    };
    text = JSON.stringify(structured, null, 2).slice(0, MCP_CHARACTER_LIMIT);
  }
  return {
    content: [{ type: "text", text: summary ? `${summary}\n\n${text}` : text }],
    structuredContent: structured,
  };
}

function safeError(error: unknown): { code: string; message: string; nextStep: string } {
  if (isMcpAuthError(error)) {
    return { code: error.code, message: error.message, nextStep: "Revise a credencial, os scopes e o projectId." };
  }
  if (error instanceof ZodError) {
    return {
      code: "INVALID_INPUT",
      message: error.issues.map((issue) => `${issue.path.join(".") || "input"}: ${issue.message}`).join("; "),
      nextStep: "Corrija apenas os campos indicados e tente novamente; campos extras não são aceitos.",
    };
  }
  const raw = error instanceof Error ? error.message : "Falha interna";
  if (/NOT_CONFIGURED|MISSING|não configurad/i.test(raw)) {
    return { code: "PROVIDER_NOT_CONFIGURED", message: "O provedor necessário não está configurado no servidor.", nextStep: "Configure a integração na tela Alpha SEO > Settings e repita a chamada." };
  }
  if (/APPROVAL_REQUIRED|Aprovação de custo/i.test(raw)) {
    return { code: "COST_APPROVAL_REQUIRED", message: "A operação exige aprovação de custo válida.", nextStep: "Execute a ferramenta de estimativa, apresente o custo ao usuário e repita com a aprovação solicitada." };
  }
  if (/NOT_FOUND|não encontrad/i.test(raw)) {
    return { code: "NOT_FOUND", message: "O recurso não foi encontrado dentro do projeto autorizado.", nextStep: "Liste os recursos do projeto e use um identificador retornado por eles." };
  }
  return { code: "TOOL_EXECUTION_FAILED", message: "A ferramenta não conseguiu concluir a operação.", nextStep: "Revise os parâmetros e o estado da integração; detalhes internos foram ocultados." };
}

export function mcpFailure(error: unknown): CallToolResult {
  const safe = safeError(error);
  return {
    isError: true,
    content: [{ type: "text", text: `${safe.code}: ${safe.message} ${safe.nextStep}` }],
    structuredContent: { error: safe },
  };
}
