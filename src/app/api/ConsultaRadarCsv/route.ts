import { NextResponse } from "next/server";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { ErroConsultaRadar, consultarRadar } from "@/lib/radar/consulta";

export const dynamic = "force-dynamic";

/** Proxy protegido: a aquisição/armazenamento do CSV é responsabilidade da API do ialpha. */
export async function GET(req: Request) {
  const denied = await requirePreAnaliseAccess("tributario");
  if (denied) return denied;
  const cnpj = new URL(req.url).searchParams.get("cnpj") || "";
  try {
    const radar = await consultarRadar(cnpj);
    const found = /HABILITAD[AO]|DEFERIDA/i.test(radar.situacao)
      && !/NÃO CONSTA|NÃO HABILITAD[AO]/i.test(radar.situacao);
    return NextResponse.json({
      found,
      ...(radar.razaoSocial ? { razaoSocial: radar.razaoSocial } : {}),
      cnpjBase: radar.cnpj,
      ...(radar.modalidade ? { modalidade: radar.modalidade } : {}),
      dataAtualizacaoPublicada: radar.dataAtualizacaoPublicada ?? null,
      consultadoEm: radar.consultadoEm || new Date().toISOString(),
      ...(!found ? { mensagem: "não consta no arquivo consultado" } : {}),
      ...(radar.aviso ? { aviso: radar.aviso } : {}),
    });
  } catch (error) {
    if (error instanceof ErroConsultaRadar && error.status === 404) {
      return NextResponse.json({ found: false, cnpjBase: cnpj.replace(/\D/g, "").slice(0, 8), dataAtualizacaoPublicada: null, consultadoEm: new Date().toISOString(), mensagem: "não consta no arquivo consultado" });
    }
    if (error instanceof ErroConsultaRadar) return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    console.error("Falha na consulta RADAR CSV", error instanceof Error ? error.name : "unknown");
    return NextResponse.json({ error: "Não foi possível consultar o arquivo RADAR" }, { status: 502 });
  }
}
