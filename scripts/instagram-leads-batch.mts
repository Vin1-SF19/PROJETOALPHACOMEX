/** CLI de validação/carga sequencial. O padrão é dryRun, sem gravar leads. */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { setTimeout as esperar } from "node:timers/promises";
import { instagramIngestSchema, leadInstagramEhTeste } from "../src/lib/bpm/instagram-leads";

const args = process.argv.slice(2);
const option = (name: string) => args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const snapshotFile = option("snapshot");
const credentialFile = option("credential");
if (!snapshotFile || !credentialFile) throw new Error("Informe --snapshot=<arquivo privado> e --credential=<arquivo privado>.");
const raw = readFileSync(snapshotFile);
const fingerprint = createHash("sha256").update(raw).digest("hex");
const snapshot = JSON.parse(raw.toString("utf8"));
const credential = JSON.parse(readFileSync(credentialFile, "utf8"));
if (credential.api !== "https://staging.alpha-comex.com/api/integrations/instagram/leads" || typeof credential.token !== "string" || credential.token.length < 32) throw new Error("Credencial deve apontar exclusivamente para a API de staging.");
if (!Array.isArray(snapshot.leads) || snapshot.leads.length > 1000) throw new Error("Snapshot deve conter até 1000 leads.");
const apply = args.includes("--apply");
const leads: Array<ReturnType<typeof instagramIngestSchema.parse>> = snapshot.leads.map((lead: unknown) => instagramIngestSchema.parse({ spreadsheetId: snapshot.spreadsheetId, sheetId: snapshot.sheetId, lead, dryRun: !apply }));
const realCount = leads.filter((input) => !leadInstagramEhTeste(input.lead)).length;
if (new Set(leads.map((input) => input.lead.id)).size !== leads.length) throw new Error("IDs duplicados no snapshot; revisar antes de enviar.");
if (apply && (option("snapshot-sha256") !== fingerprint || Number(option("expected-leads")) !== realCount || !option("receipt"))) {
  throw new Error("Carga exige --snapshot-sha256=<hash revisado> --expected-leads=<total revisado> --receipt=<arquivo privado>, além da autorização aplicável ao lote.");
}
const resultados: Array<{ externalId: string; http: number; success: boolean; leadId?: string; ignored?: boolean; duplicate?: boolean; dryRun?: boolean; review?: unknown; code?: string }> = [];
for (const input of leads) {
  let status = 0;
  let body: Record<string, unknown> = {};
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    try {
      const response = await fetch(credential.api, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(20_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${credential.token}` }, body: JSON.stringify(input) });
      status = response.status;
      try { body = await response.json(); } catch { body = {}; }
      if (status !== 429 && status < 500) break;
    } catch { status = 0; body = { code: "SEM_CONFIRMACAO" }; }
    if (tentativa < 2) await esperar(tentativa === 0 ? 2000 : 5000);
  }
  const identificado = status >= 200 && status < 300 && body.success === true && body.externalId === input.lead.id;
  const ignored = identificado && body.ignored === true && body.reason === "LEAD_DE_TESTE";
  const success = identificado && (ignored || (apply ? typeof body.leadId === "string" && body.dryRun !== true : body.dryRun === true));
  resultados.push({ externalId: input.lead.id, http: status, success, ...(typeof body.leadId === "string" ? { leadId: body.leadId } : {}),
    ignored, duplicate: body.duplicate === true, dryRun: body.dryRun === true,
    ...(body.review ? { review: body.review } : {}), ...(typeof body.code === "string" ? { code: body.code } : {}) });
  if (!success && (status === 401 || status === 403 || status === 503 || status === 0)) break;
}
const resumo = { ambiente: "staging", modo: apply ? "apply" : "dryRun", snapshotSha256: fingerprint, reaisNoSnapshot: realCount,
  enviados: resultados.length, confirmados: resultados.filter((r) => r.success && !r.ignored).length, ignorados: resultados.filter((r) => r.ignored).length,
  duplicados: resultados.filter((r) => r.duplicate).length, falhas: resultados.filter((r) => !r.success).length,
  revisaoRadar: resultados.filter((r) => (r.review as { radar?: boolean } | undefined)?.radar).length,
  revisaoCnpj: resultados.filter((r) => (r.review as { cnpj?: boolean } | undefined)?.cnpj).length };
const receipt = option("receipt");
if (receipt) writeFileSync(receipt, JSON.stringify({ ...resumo, resultados }, null, 2), { mode: 0o600, flag: "wx" });
console.log(JSON.stringify(resumo));
if (resumo.falhas || resultados.length !== leads.length) process.exitCode = 1;
