import path from "node:path";

import { isSensitiveRoadmapPath } from "@/lib/roadmap-production/protected-path";

export type ProductionPolicyLevel = "SAFE" | "SENSITIVE" | "FORBIDDEN";

export interface ProductionPolicyDecision {
  level: ProductionPolicyLevel;
  code: string;
  normalizedAction: string;
  guidance: string;
}

const SAFE_COMMANDS = new Set([
  "git status",
  "git diff",
  "npm run lint",
  "npm run typecheck",
  "npm test",
]);

const SAFE_TOOLS = new Set([
  "list_files",
  "search_code",
  "read_file",
  "create_file",
  "replace_in_file",
]);

const PROTECTED_SEGMENTS = new Set([
  ".git",
  ".env",
  "node_modules",
  "prisma",
  "database-backups",
]);

export function normalizeProductionAction(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1_000);
}

function isSafeWorkspacePath(root: string, candidate?: string): boolean {
  if (!candidate) return true;
  const normalizedRoot = path.resolve(root);
  const target = path.resolve(normalizedRoot, candidate);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${path.sep}`)) {
    return false;
  }
  const relative = path.relative(normalizedRoot, target);
  const segments = relative.split(/[\\/]+/).filter(Boolean);
  if (segments.some((segment) => PROTECTED_SEGMENTS.has(segment.toLowerCase()))) {
    return false;
  }
  return (
    !relative.split(/[\\/]+/).includes("..") &&
    !isSensitiveRoadmapPath(relative)
  );
}

function containsShellComposition(value: string): boolean {
  return /[\r\n;&|<>`]/.test(value) || /\$\(/.test(value);
}

function isSafeTargetedNpmTest(command: string): boolean {
  const prefix = "npm test -- ";
  if (!command.startsWith(prefix)) return false;
  const targets = command.slice(prefix.length).split(" ");
  if (!targets.length || targets.length > 20 || targets.some((item) => !item)) {
    return false;
  }
  return targets.every((target) => {
    if (!/^[a-z0-9_./\\-]+$/i.test(target) || target.startsWith("-")) {
      return false;
    }
    const normalized = target.replaceAll("\\", "/");
    const segments = normalized.split("/");
    return (
      normalized.startsWith("tests/") &&
      !path.posix.isAbsolute(normalized) &&
      !segments.includes("..")
    );
  });
}

export function classifyProductionAction(input: {
  action: string;
  root?: string;
  path?: string;
  tool?: string;
}): ProductionPolicyDecision {
  const normalizedAction = normalizeProductionAction(input.action);
  const lower = normalizedAction.toLocaleLowerCase("pt-BR");
  const root = input.root ?? process.cwd();

  if (containsShellComposition(input.action)) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_COMPOSED_COMMAND_FORBIDDEN",
      normalizedAction,
      guidance:
        "Composição, redirecionamento e subshell não são aceitos em comandos da allowlist.",
    };
  }

  if (!isSafeWorkspacePath(root, input.path)) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_OUTSIDE_WORKSPACE",
      normalizedAction,
      guidance: "A escrita fora do workspace não pode ser autorizada pela Sala.",
    };
  }
  if (
    /(?:prisma[\\/]schema\.prisma|\bprisma(?:\.cmd|\.exe)?\b|\bsqlite3(?:\.exe)?\b|\bmigra(?:tion|te|ção)|\b(?:alter|drop|truncate)\s+(?:table|index)|\bseed\b|\bbackfill\b|\bdelete\s+from\b|\bdeleteMany\b|\bupdateMany\b)/i.test(
      normalizedAction,
    )
  ) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_DATABASE_VAULT_REQUIRED",
      normalizedAction,
      guidance:
        "Alterações de banco exigem Vault, backup completo verificado de até 48 horas, relatório de impacto/rollback e confirmação explícita fora da automação.",
    };
  }
  if (
    /\bgit(?:\.exe)?\b(?:(?![;&|]).){0,240}\b(?:commit|push|reset|checkout|switch|merge|rebase|tag|clean)\b|\bgh(?:\.exe)?\s+(?:pr|release)\b|\bpull request\b|\brelease\b/i.test(
      normalizedAction,
    )
  ) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_DEVOPS_REQUIRED",
      normalizedAction,
      guidance: "Commit, push, PR, release e tag permanecem exclusivos do DevOps.",
    };
  }
  if (/\b(?:rm|rmdir|del|erase|remove-item|clear-content)\b|\breset\s+--hard\b/i.test(lower)) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_DESTRUCTIVE_COMMAND",
      normalizedAction,
      guidance: "Comandos destrutivos ou recursivos não podem ser autorizados pela Sala.",
    };
  }
  if (
    /\b(npm|pnpm|yarn|bun)\s+(?:install|add|update)|\b(?:curl|wget|invoke-webrequest|fetch)\b|https?:\/\/|\b(?:sudo|runas|elevad[oa])\b|\b(?:token|credential|credentials|credencial|credenciais|api key|secret|senha|password)\b/i.test(
      normalizedAction,
    )
  ) {
    return {
      level: "SENSITIVE",
      code: "POLICY_EXPLICIT_AUTHORIZATION_REQUIRED",
      normalizedAction,
      guidance: "A ação exige autorização explícita, de uso único e vinculada a esta fase.",
    };
  }
  const commandIsSafe = SAFE_COMMANDS.has(lower) || isSafeTargetedNpmTest(lower);
  const toolIsSafe = input.tool ? SAFE_TOOLS.has(input.tool) : false;
  if (commandIsSafe || toolIsSafe) {
    return {
      level: "SAFE",
      code: "POLICY_SAFE_ALLOWLISTED",
      normalizedAction,
      guidance: "Ação segura já contemplada pela allowlist do worker.",
    };
  }
  return {
    level: "FORBIDDEN",
    code: "POLICY_UNKNOWN_EXECUTABLE_FORBIDDEN",
    normalizedAction,
    guidance: "Ação não reconhecida pela allowlist executável permanece bloqueada.",
  };
}

export function policyLevelForCategory(
  category: string,
): ProductionPolicyLevel {
  if (["DATABASE", "DESTRUCTIVE", "GIT_REMOTE"].includes(category)) {
    return "FORBIDDEN";
  }
  if (["PERMISSION", "CREDENTIAL", "EXTERNAL_ACTION"].includes(category)) {
    return "SENSITIVE";
  }
  return "SAFE";
}
