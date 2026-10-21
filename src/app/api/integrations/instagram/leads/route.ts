import { NextRequest, NextResponse } from "next/server";
import { instagramIngestSchema, leadInstagramEhTeste, prepararLeadInstagram } from "@/lib/bpm/instagram-leads";
import { autenticarInstagram, etapaEntradaInstagram, ErroInstagram, receberInstagramLead } from "@/lib/bpm/instagram-leads-server";
import { notificarPipelineBpm } from "@/lib/bpm/realtime-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const MAX_BODY = 32 * 1024;
const responder = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Um lead por chamada. Sem sessão; credencial exclusiva da integração Instagram. */
export async function POST(req: NextRequest) {
  try {
    const endpoint = await autenticarInstagram(req.headers.get("authorization"));
    if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return responder({ success: false, code: "PAYLOAD_GRANDE", error: "Limite de 32 KiB excedido." }, 413);
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let tamanho = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        tamanho += value.byteLength;
        if (tamanho > MAX_BODY) { await reader.cancel(); return responder({ success: false, code: "PAYLOAD_GRANDE", error: "Limite de 32 KiB excedido." }, 413); }
        chunks.push(value);
      }
    }
    let body: unknown;
    try { body = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
    catch { return responder({ success: false, code: "JSON_INVALIDO", error: "JSON inválido." }, 400); }
    const parsed = instagramIngestSchema.safeParse(body);
    if (!parsed.success) return responder({ success: false, code: "DADOS_INVALIDOS", error: "Confira a fonte, os campos obrigatórios e seus formatos.",
      fields: parsed.error.issues.map((issue) => issue.path.join(".")) }, 422);
    const { lead, dryRun } = parsed.data;
    if (leadInstagramEhTeste(lead)) return responder({ success: true, ignored: true, reason: "LEAD_DE_TESTE", externalId: lead.id });
    await etapaEntradaInstagram(endpoint.pipelineId!);
    if (dryRun) {
      const dados = prepararLeadInstagram(lead);
      return responder({ success: true, dryRun: true, externalId: lead.id, radarPretendido: dados.radarPretendido,
        review: { radar: !dados.radarPretendido, cnpj: !dados.cnpj, telefone: !dados.telefone } });
    }
    const resultado = await receberInstagramLead(endpoint.id, lead);
    if (!resultado.duplicate) await notificarPipelineBpm({ pipelineId: endpoint.pipelineId!, tipo: "CARD_CRIADO" });
    return responder({ success: true, externalId: lead.id, ...resultado }, resultado.duplicate ? 200 : 201);
  } catch (error) {
    if (error instanceof ErroInstagram) return responder({ success: false, code: error.codigo, error: error.message }, error.status);
    console.error("[InstagramLeads] Falha ao receber lead", { code: typeof error === "object" && error && "code" in error ? error.code : "INTERNAL" });
    return responder({ success: false, code: "ERRO_INTERNO", error: "Não foi possível receber o lead. Reenvie com o mesmo ID." }, 500);
  }
}
