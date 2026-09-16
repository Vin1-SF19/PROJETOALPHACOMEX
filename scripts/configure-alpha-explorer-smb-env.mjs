import { readFile, writeFile } from "node:fs/promises";

const [envPath, secretPath, gatewayUrl] = process.argv.slice(2);
if (!envPath || !secretPath || !gatewayUrl) {
  throw new Error("usage: configure-alpha-explorer-smb-env <env-file> <stage-secret-file> <gateway-url>");
}

const secret = (await readFile(secretPath, "utf8")).trim();
if (secret.length < 32) throw new Error("stage ticket secret is invalid");

const values = new Map(Object.entries({
  ALPHA_EXPLORER_SMB_ENABLED: "true",
  ALPHA_EXPLORER_SMB_ENROLLMENT_ENABLED: "true",
  ALPHA_EXPLORER_SMB_WRITE_ENABLED: "false",
  ALPHA_EXPLORER_SMB_GATEWAY_URL: gatewayUrl,
  ALPHA_EXPLORER_SMB_AUDIENCE: "alpha-explorer-smb-gateway",
  ALPHA_EXPLORER_SMB_PRODUCTION_ORIGIN: "https://painel.alpha-comex.com",
  ALPHA_EXPLORER_SMB_STAGE_ORIGIN: "https://stagealpha-sistema.alpak.ai",
  ALPHA_EXPLORER_SMB_RUNTIME: "stage",
  ALPHA_EXPLORER_SMB_ISSUER: "alpha-explorer-stage",
  ALPHA_EXPLORER_SMB_TICKET_KID: "alpha-explorer-stage-2026",
  ALPHA_EXPLORER_SMB_TICKET_SECRET: secret,
}));

const source = await readFile(envPath, "utf8").catch(() => "");
const seen = new Set();
const output = source.split(/\r?\n/).map((line) => {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
  if (!match || !values.has(match[1])) return line;
  seen.add(match[1]);
  return `${match[1]}=${values.get(match[1])}`;
});
for (const [key, value] of values) {
  if (!seen.has(key)) output.push(`${key}=${value}`);
}
await writeFile(envPath, `${output.filter((line, index, lines) => line || index < lines.length - 1).join("\n")}\n`, { mode: 0o600 });
process.stdout.write(JSON.stringify({ ok: true, configuredKeys: values.size }));
