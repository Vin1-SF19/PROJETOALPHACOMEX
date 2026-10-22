import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { requirePreAnaliseAccess } from "@/lib/pre-analise/access";
import { EsperaReceitaWS, ErroReceitaWS } from "@/lib/cnpj/receitaws";
import { getReceitaData } from "@/lib/cnpj/receita-federal";
import { parseDateBR } from "@/lib/cnpj/parse-date-br";
import { consultarRadar, ErroConsultaRadar } from "@/lib/radar/consulta";
import { validarCnpj } from "@/lib/gerador-documentos/cnpj";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 180;

export async function GET(req: Request) {
  const denied = await requirePreAnaliseAccess("tributario");
  if (denied) return denied;
  try {
    const { searchParams } = new URL(req.url);
    const cnpjRaw = searchParams.get("cnpj") || "";
    const cnpj = cnpjRaw.replace(/\D/g, "");
    const forcar = searchParams.get("forcar") === "true";
    const somenteBanco = searchParams.get("somenteBanco") === "true";

    if (!validarCnpj(cnpj)) {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
    }

    // Busca no banco local primeiro
    if (!forcar) {
      const existente = await db.consultas_radar.findUnique({ where: { cnpj } });
      if (existente && existente.razao_social && existente.razao_social !== "NÃO ENCONTRADO") {
        let radarAtualizacao: Awaited<ReturnType<typeof consultarRadar>> | null = null;
        try {
          radarAtualizacao = await consultarRadar(cnpj);
        } catch {
          // Mantém os dados locais existentes se a API do ialpha estiver temporariamente indisponível.
        }
        return NextResponse.json({
          ...existente,
          // aliases camelCase para o frontend
          razaoSocial:      existente.razao_social,
          nomeFantasia:     existente.nome_fantasia,
          situacao:         radarAtualizacao?.situacao ?? "CONSULTA CSV INDISPONÍVEL",
          situacao_radar:   radarAtualizacao?.situacao ?? "CONSULTA CSV INDISPONÍVEL",
          submodalidade:    radarAtualizacao?.submodalidade ?? existente.submodalidade,
          modalidade:       radarAtualizacao?.modalidade ?? existente.submodalidade,
          contribuinte:     radarAtualizacao?.contribuinte ?? existente.contribuinte,
          dataAtualizacaoPublicada: radarAtualizacao?.dataAtualizacaoPublicada ?? null,
          consultadoEm:     radarAtualizacao?.consultadoEm ?? null,
          radarAviso:       radarAtualizacao?.aviso ?? (radarAtualizacao ? undefined : "Consulta atual à API RADAR indisponível; exibindo registro local."),
          dataSituacao:     existente.data_situacao,
          dataConstituicao: existente.data_constituicao,
          regimeTributario: existente.regime_tributario,
          capitalSocial:    existente.capital_social,
          dataConsulta:     existente.data_consulta,
          fonte:            radarAtualizacao ? "Banco Local + API RADAR ialpha" : "Banco Local",
        });
      }
    }

    // Se somenteBanco=true e não achou, retorna vazio
    if (somenteBanco) {
      return NextResponse.json(null, { status: 404 });
    }

    // Valida ReceitaWS antes de chamar Radar: nenhuma consulta Radar em caso de falha cadastral.
    const [receitaResult] = await Promise.allSettled([getReceitaData(cnpj)]);

    // Receita Federal é obrigatória
    if (receitaResult.status === "rejected") {
      const error = receitaResult.reason;
      if (error instanceof EsperaReceitaWS) return NextResponse.json({ error: error.message, segundos: error.segundos }, {
        status: 429, headers: { 'Retry-After': String(error.segundos) },
      });
      if (error instanceof ErroReceitaWS) return NextResponse.json({ error: error.message, code: error.codigo }, { status: error.status });
      console.error("Receita Federal falhou");

      // Não sobrescreve dado bom já salvo por causa de uma falha transitória (ex: reconsulta).
      const existenteAntesDoErro = await db.consultas_radar.findUnique({
        where: { cnpj },
        select: { razao_social: true },
      });
      const jaTemDadosReais = !!(
        existenteAntesDoErro?.razao_social &&
        existenteAntesDoErro.razao_social !== "" &&
        existenteAntesDoErro.razao_social !== "ERRO NA CONSULTA" &&
        existenteAntesDoErro.razao_social !== "NÃO ENCONTRADO"
      );

      if (jaTemDadosReais) {
        return NextResponse.json(
          { error: "Receita Federal fora do ar ou CNPJ não encontrado" },
          { status: 502 }
        );
      }

      // Sem dado bom prévio: salva um placeholder de ERRO para o registro aparecer na
      // tabela e ficar elegível para reconsulta — sem isso, a falha some silenciosamente.
      const payloadErro = {
        cnpj,
        razao_social: "ERRO NA CONSULTA",
        nome_fantasia: "",
        situacao_radar: "ERRO NA CONSULTA",
        submodalidade: "",
        data_situacao: null,
        municipio: "",
        uf: "",
        regime_tributario: "",
        data_opcao: null,
        capital_social: "0",
        data_constituicao: null,
        contribuinte: "",
        fonte: forcar ? "Reconsulta (erro Receita)" : "API Externa (erro Receita)",
        json_completo: JSON.stringify({
          erro: String((receitaResult as PromiseRejectedResult).reason?.message || (receitaResult as PromiseRejectedResult).reason),
        }),
        data_consulta: new Date().toISOString(),
      };

      const salvoErro = await db.consultas_radar.upsert({
        where: { cnpj },
        update: payloadErro,
        create: payloadErro,
      });

      return NextResponse.json({
        ...salvoErro,
        razaoSocial:      salvoErro.razao_social,
        nomeFantasia:     salvoErro.nome_fantasia,
        situacao:         salvoErro.situacao_radar,
        dataSituacao:     salvoErro.data_situacao,
        dataConstituicao: salvoErro.data_constituicao,
        regimeTributario: salvoErro.regime_tributario,
        capitalSocial:    salvoErro.capital_social,
        dataConsulta:     salvoErro.data_consulta,
      });
    }

    const receita = receitaResult.value;
    const [radarResult] = await Promise.allSettled([consultarRadar(cnpj)]);

    let radar: Awaited<ReturnType<typeof consultarRadar>> = {
      cnpj: cnpj.slice(0, 8),
      razaoSocial: "",
      situacao: "NÃO VERIFICADO NA PUBLICAÇÃO CSV",
      modalidade: "",
      submodalidade: "N/A",
      contribuinte: "",
      dataSituacao: "",
      dataAtualizacaoPublicada: null,
      consultadoEm: new Date().toISOString(),
      baseLegal: "",
      tipoDesabilitacao: "",
      operacoesAutorizadas: "",
      raw: "",
    };
    if (radarResult.status === "fulfilled") {
      radar = radarResult.value;
    } else if (radarResult.reason instanceof ErroConsultaRadar && radarResult.reason.status === 404) {
      // A ausência de registro na publicação periódica não confirma desabilitação.
    } else {
      const code = radarResult.reason instanceof ErroConsultaRadar ? radarResult.reason.code : "UPSTREAM_UNAVAILABLE";
      console.error("RADAR falhou:", code);
      return NextResponse.json({ error: "Consulta Radar indisponível; dados anteriores preservados", code }, { status: 502 });
    }

    const payload = {
      cnpj,
      razao_social: String(receita.razaoSocial || "NÃO ENCONTRADO").toUpperCase(),
      nome_fantasia: String(receita.nomeFantasia || "").toUpperCase(),
      situacao_radar: String(radar.situacao).toUpperCase(),
      submodalidade: String(radar.submodalidade),
      data_situacao: parseDateBR(radar.dataSituacao),
      municipio: String(receita.municipio || "").toUpperCase(),
      uf: String(receita.uf || "").toUpperCase(),
      regime_tributario: String(receita.regimeTributario || ""),
      data_opcao: parseDateBR(receita.data_opcao),
      capital_social: String(receita.capitalSocial || "0"),
      data_constituicao: parseDateBR(receita.dataConstituicao),
      contribuinte: String(radar.contribuinte || receita.razaoSocial || "").toUpperCase(),
      fonte: forcar ? "Reconsulta" : "API Externa",
      json_completo: JSON.stringify({ radar, receita }),
      data_consulta: new Date().toISOString(),
    };

    const salvo = await db.consultas_radar.upsert({
      where: { cnpj },
      update: payload,
      create: payload,
    });

    return NextResponse.json({
      ...salvo,
      // aliases camelCase para o frontend
      razaoSocial:      salvo.razao_social,
      nomeFantasia:     salvo.nome_fantasia,
      situacao:         salvo.situacao_radar,
      dataSituacao:     salvo.data_situacao,
      dataConstituicao: salvo.data_constituicao,
      regimeTributario: salvo.regime_tributario,
      capitalSocial:    salvo.capital_social,
      dataConsulta:     salvo.data_consulta,
      dataAtualizacaoPublicada: radar.dataAtualizacaoPublicada,
      consultadoEmRadar: radar.consultadoEm,
      radarAviso: radar.aviso,
    });
  } catch (error) {
    console.error("ERRO CONSULTACOMPLETA:", error);
    return NextResponse.json({ error: "Falha interna" }, { status: 500 });
  }
}
