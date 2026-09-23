import { NextResponse } from "next/server";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await requirePreAnaliseAccess("tributario");
  if (denied) return denied;
  const cnpj = (new URL(req.url).searchParams.get("cnpj") || "").replace(/\D/g, "");
  if (!validarCnpj(cnpj)) {
    return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
  }

  const token = process.env.API_TOKEN;
  const urlRadar = process.env.URL_RADAR;
  if (!token || !urlRadar) {
    return NextResponse.json({ error: "API RADAR não configurada" }, { status: 503 });
  }

  try {
    const response = await fetch(urlRadar, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ cnpj, token, timeout: "30" }).toString(),
      signal: AbortSignal.timeout(35_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Serviço RADAR indisponível" }, { status: 502 });
    }
    const json: unknown = await response.json();
    if (!json || typeof json !== "object" || Array.isArray(json)) throw new Error("invalid_json");
    const payload = json as Record<string, unknown>;
    if (payload.code !== undefined && Number(payload.code) !== 200) {
      return NextResponse.json({ error: "Consulta RADAR não concluída" }, { status: 502 });
    }
    const raw = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      return NextResponse.json({ error: "RADAR não retornou dados para o CNPJ" }, { status: 404 });
    }
    const dados = raw as Record<string, unknown>;
    const first = (...keys: string[]): string => {
      for (const key of keys) {
        if (typeof dados[key] === "string" && dados[key].trim()) return dados[key].trim();
      }
      return "";
    };
    const situacao = first("situacao", "situacao_habilitacao", "descricao_situacao", "status");
    if (!situacao) {
      return NextResponse.json({ error: "Resposta RADAR incompleta" }, { status: 502 });
    }
    return NextResponse.json({
      contribuinte: first("contribuinte", "nome_contribuinte", "razao_social", "nome"),
      situacao,
      dataSituacao: first("data_situacao", "situacao_data", "data_evento", "data"),
      submodalidade: first("submodalidade", "submodalidade_texto", "modalidade") || null,
    });
  } catch {
    console.error("[ConsultaRadar] Falha na consulta externa");
    return NextResponse.json({ error: "Não foi possível consultar o RADAR" }, { status: 502 });
  }
}
