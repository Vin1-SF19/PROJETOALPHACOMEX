import path from "node:path";

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
  "search_files",
  "read_file",
  "create_file",
  "replace_in_file",
  "run_quality_gate",
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
  return !relative.split(/[\\/]+/).includes("..");
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

  if (!isSafeWorkspacePath(root, input.path)) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_OUTSIDE_WORKSPACE",
      normalizedAction,
      guidance: "A escrita fora do workspace não pode ser autorizada pela Sala.",
    };
  }
  if (
    /(?:prisma[\\/]schema\.prisma|\bmigra(?:tion|te|ção)|\b(?:alter|drop|truncate)\s+(?:table|index)|\bseed\b|\bbackfill\b|\bdelete\s+from\b|\bdeleteMany\b|\bupdateMany\b)/i.test(
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
    /\b(git\s+(?:commit|push|reset|checkout|switch|merge|rebase|tag)|gh\s+pr|pull request|release)\b/i.test(
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
  if (/\b(rm|rmdir|del|remove-item)\b.*(?:-r|-recurse|\/s)|\breset\s+--hard\b/i.test(lower)) {
    return {
      level: "FORBIDDEN",
      code: "POLICY_DESTRUCTIVE_COMMAND",
      normalizedAction,
      guidance: "Comandos destrutivos ou recursivos não podem ser autorizados pela Sala.",
    };
  }
  if (
    /\b(npm|pnpm|yarn|bun)\s+(?:install|add|update)|\b(?:curl|wget|invoke-webrequest)\b|https?:\/\/|\b(?:sudo|runas|elevad[oa])\b|\b(?:token|credential|credencial|api key|secret)\b/i.test(
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
  const commandIsSafe = SAFE_COMMANDS.has(lower) || /^npm test --\s+\S+/.test(lower);
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
    level: "SENSITIVE",
    code: "POLICY_UNKNOWN_ACTION_REQUIRES_REVIEW",
    normalizedAction,
    guidance: "Ação não reconhecida não é promovida a segura por texto do prompt.",
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
