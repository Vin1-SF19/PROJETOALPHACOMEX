const OS_ENV_ALLOWLIST = new Set([
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "SYSTEMDRIVE",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USER",
  "USERNAME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMDATA",
  "XDG_CONFIG_HOME",
  "XDG_CACHE_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TERM",
  "NODE_ENV",
]);

const PROVIDER_CONFIG_ENV = {
  codex: new Set(["CODEX_HOME"]),
  claude: new Set(["CLAUDE_CONFIG_DIR"]),
  gate: new Set<string>(),
} as const;

export type RoadmapSubprocessKind = keyof typeof PROVIDER_CONFIG_ENV;

/**
 * Subprocessos da Produção recebem somente localização do SO e de configuração
 * persistida. Credenciais em env (inclusive chaves dos próprios providers) não
 * são encaminhadas ao processo agente; autenticação deve vir do login da CLI.
 */
export function buildRoadmapSubprocessEnv(
  kind: RoadmapSubprocessKind,
  source: Readonly<Record<string, string | undefined>> = process.env,
): NodeJS.ProcessEnv {
  const allowed = PROVIDER_CONFIG_ENV[kind];
  const environment: NodeJS.ProcessEnv = {
    NODE_ENV:
      (source.NODE_ENV as NodeJS.ProcessEnv["NODE_ENV"] | undefined) ??
      "production",
  };
  for (const [name, value] of Object.entries(source)) {
    if (value === undefined) continue;
    const normalizedName = name.toLocaleUpperCase("en-US");
    if (OS_ENV_ALLOWLIST.has(normalizedName) || allowed.has(normalizedName)) {
      environment[name] = value;
    }
  }
  environment.NO_COLOR = "1";
  return environment;
}
