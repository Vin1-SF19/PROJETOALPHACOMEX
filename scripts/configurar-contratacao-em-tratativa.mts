/** Default read-only. Environment must be loaded explicitly outside this script. */
import { createClient } from "@libsql/client";
import { readFile, open } from "node:fs/promises";
import { prepararContratacao, aplicarContratacao, verificarContratacao, reverterContratacao, type PlanoContratacao, type ReciboContratacao } from "../src/lib/bpm/contratacao-em-tratativa-config";

const args = process.argv.slice(2);
const modes = args.filter((arg) => ["--preview", "--apply", "--verify", "--rollback"].includes(arg));
if (modes.length > 1 || args.some((arg) => !/^(--preview|--apply|--verify|--rollback|--(?:plan|receipt|out|fingerprint|approval|admin-id|backup|manifest)=.+)$/.test(arg))) throw new Error("Argumentos inválidos. Use --preview (padrão), --apply, --verify ou --rollback.");
const mode = modes[0] ?? "--preview";
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const url = process.env.TURSO_DATABASE_URL;
if (!url || !/^(libsql:\/\/|file:)/.test(url)) throw new Error("TURSO_DATABASE_URL explícita obrigatória.");
const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
try {
  const output = option("out");
  if (!output) throw new Error("--out obrigatório para salvar plano/recibo privado (não versionar).");
  // Reserva o destino antes de qualquer transação: falha de permissão/arquivo existente não pode ocorrer depois do commit.
  const outputFile = await open(output, "wx", 0o600);
  const load = async (name: string) => {
    const file = option(name); if (!file) throw new Error(`--${name} obrigatório.`);
    return JSON.parse(await readFile(file, "utf8"));
  };
  const auth = { fingerprint: option("fingerprint") ?? "", approval: option("approval") ?? "", adminId: Number(option("admin-id")), backup: option("backup") ?? "", manifest: option("manifest") ?? "" };
  try {
  let result: unknown;
  if (mode === "--preview") result = await prepararContratacao(client, url);
  else if (mode === "--apply") result = await aplicarContratacao(client, url, await load("plan") as PlanoContratacao, auth);
  else if (mode === "--verify") result = await verificarContratacao(client, url, await load("receipt") as ReciboContratacao);
  else result = await reverterContratacao(client, url, await load("receipt") as ReciboContratacao, auth);
  await outputFile.writeFile(`${JSON.stringify(result, null, 2)}\n`);
  await outputFile.sync();
  process.stdout.write(`${JSON.stringify({ mode, output, fingerprint: mode === "--preview" ? (result as PlanoContratacao).fingerprint : auth.fingerprint || undefined, success: true })}\n`);
  } finally { await outputFile.close(); }
} finally { client.close(); }
