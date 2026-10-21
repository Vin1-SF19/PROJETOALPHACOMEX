/** Configuração individual do inbox; --preview é o padrão, --apply cria somente o endpoint. */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { parse } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql/web";
import { INSTAGRAM_ENDPOINT_SLUG } from "../src/lib/bpm/instagram-leads";
import { isAdminRole } from "../src/lib/roles";

const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const envFile = option("env-file");
if (!envFile || !envFile.endsWith(".env.staging.local")) throw new Error("Informe --env-file=.env.staging.local explicitamente. Produção não é configurada por este comando.");
const env = parse(readFileSync(envFile));
if (!env.TURSO_DATABASE_URL || !env.TURSO_AUTH_TOKEN) throw new Error("Credenciais de staging ausentes.");
for (const file of [".env.local", ".env"]) {
  if (existsSync(file) && parse(readFileSync(file)).TURSO_DATABASE_URL === env.TURSO_DATABASE_URL) throw new Error("O banco de staging coincide com o ambiente padrão. Revise a configuração.");
}
const db = new PrismaClient({ adapter: new PrismaLibSQL({ url: env.TURSO_DATABASE_URL.replace(/^libsql:/, "https:"), authToken: env.TURSO_AUTH_TOKEN }), log: [] });
try {
  const adminId = Number(option("admin-id"));
  if (!Number.isInteger(adminId) || adminId <= 0) throw new Error("Informe --admin-id=<id> do autor administrativo, sem atribuir os leads a ele.");
  const admin = await db.usuarios.findUnique({ where: { id: adminId }, select: { id: true, role: true, status: true } });
  if (!admin || admin.status !== "ATIVO" || !isAdminRole(admin.role)) throw new Error("Autor deve ser administrador ativo.");
  const pipelines = await db.bpmPipeline.findMany({ where: { nome: "Revisão de Radar", ativo: true }, select: { id: true } });
  if (pipelines.length !== 1) throw new Error("Pipeline Revisão de Radar ausente ou ambíguo.");
  const existente = await db.bpmWebhookEndpoint.findUnique({ where: { caminhoSlug: INSTAGRAM_ENDPOINT_SLUG }, select: { id: true, pipelineId: true, ativo: true, automacaoId: true } });
  if (existente) {
    if (existente.pipelineId !== pipelines[0].id || existente.automacaoId) throw new Error("Endpoint existente pertence a outro contexto.");
    console.log(JSON.stringify({ ambiente: "staging", existente: true, endpointId: existente.id, ativo: existente.ativo,
      env: `INSTAGRAM_LEADS_ENDPOINT_ID=${existente.id}`, segredo: "Preservado; recuperar pelo canal privado original. Não recriar nem excluir o endpoint." }));
  } else if (!args.includes("--apply")) {
    console.log(JSON.stringify({ modo: "preview", ambiente: "staging", operacao: "Criar um endpoint de integração, sem leads ou mudança de schema", pipelineId: pipelines[0].id, autorAdminId: adminId, responsavelLead: null }));
  } else {
    const secretFile = option("secret-file");
    if (!secretFile) throw new Error("Informe --secret-file=<caminho privado fora do Git>.");
    const destino = resolve(secretFile);
    if (!destino.startsWith("/tmp/") && !destino.includes("/database-backups/")) throw new Error("Use arquivo privado em /tmp ou database-backups (fora do Git).");
    if (existsSync(destino)) throw new Error("Arquivo de credencial já existe; não será sobrescrito.");
    const segredo = randomBytes(32).toString("base64url");
    // Gravar a credencial antes da configuração evita perder o único segredo em erro de I/O.
    writeFileSync(destino, JSON.stringify({ token: segredo, api: "https://staging.alpha-comex.com/api/integrations/instagram/leads" }, null, 2), { mode: 0o600, flag: "wx" });
    const endpoint = await db.bpmWebhookEndpoint.create({ data: {
      nome: "Leads Instagram — planilha", descricao: "Inbox exclusivo de leads virtuais Instagram. Desativar para pausar; nunca excluir.",
      caminhoSlug: INSTAGRAM_ENDPOINT_SLUG, segredoHash: await hash(segredo, 12), criadoPorId: adminId,
      pipelineId: pipelines[0].id, headersEsperadosJson: JSON.stringify(["Authorization"]),
    }, select: { id: true } });
    console.log(JSON.stringify({ modo: "apply", ambiente: "staging", endpointId: endpoint.id,
      env: `INSTAGRAM_LEADS_ENDPOINT_ID=${endpoint.id}`, credencialPrivada: destino, leadsCriados: 0 }));
  }
} finally { await db.$disconnect(); }
