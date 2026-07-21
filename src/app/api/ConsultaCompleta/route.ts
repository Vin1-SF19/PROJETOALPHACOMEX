import { NextResponse } from "next/server";
import db from "@/lib/prisma";
import { getReceitaData } from "@/app/api/ReceitaFederal/route";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function parseDateBR(value: any): string | null {
  if (!value || value === "" || value === "N/A") return null;
  try {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d.toISOString();
    if (typeof value === "string" && value.includes("/")) {
      const [day, month, year] = value.split("/").map(Number);
      const dt = new Date(year, month - 1, day, 12, 0, 0);
      if (!isNaN(dt.getTime())) return dt.toISOString();
    }
  } catch {}
  return null;
}

// Consulta RADAR direto na InfoSimples (sem HTTP interno)
async function getRadarData(cnpj: string) {
  const token = process.env.API_TOKEN;
  const urlRadar = process.env.URL_RADAR;

  if (!token || !urlRadar) {
    throw new Error("API RADAR não configurada (API_TOKEN ou URL_RADAR ausente)");
  }

  const params = new URLSearchParams();
  params.append("cnpj", cnpj);
  params.append("token", token);
  params.append("timeout", "300");

  const resp = await fetch(urlRadar, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(30000),
  });

  if (!resp.ok) throw new Error(`RADAR HTTP ${resp.status}`);

  const json = await resp.json();
  const raw = json?.data;
  const dados = Array.isArray(raw) ? raw[0] : raw || null;

  return {
    contribuinte:
      dados?.contribuinte ||
      dados?.nome_contribuinte ||
      dados?.razao_social ||
      dados?.nome ||
      "",
    situacao:
      dados?.situacao ||
      dados?.situacao_habilitacao ||
      dados?.descricao_situacao ||
      dados?.status ||
      "NÃO HABILITADA",
    dataSituacao:
      dados?.data_situacao ||
      dados?.situacao_data ||
      dados?.data_evento ||
      dados?.data ||
      "",
    submodalidade:
      dados?.submodalidade ||
      dados?.submodalidade_texto ||
      dados?.modalidade ||
      "NÃO HABILITADO",
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const cnpjRaw = searchParams.get("cnpj") || "";
    const cnpj = cnpjRaw.replace(/\D/g, "").padStart(14, "0").substring(0, 14);
    const forcar = searchParams.get("forcar") === "true";
    const somenteBanco = searchParams.get("somenteBanco") === "true";

    if (!cnpj || cnpj === "00000000000000") {
      return NextResponse.json({ error: "CNPJ inválido" }, { status: 400 });
    }

    // Busca no banco local primeiro
    if (!forcar) {
      const existente = await db.consultas_radar.findUnique({ where: { cnpj } });
      if (existente && existente.razao_social && existente.razao_social !== "NÃO ENCONTRADO") {
        return NextResponse.json({
          ...existente,
          // aliases camelCase para o frontend
          razaoSocial:      existente.razao_social,
          nomeFantasia:     existente.nome_fantasia,
          situacao:         existente.situacao_radar,
          dataSituacao:     existente.data_situacao,
          dataConstituicao: existente.data_constituicao,
          regimeTributario: existente.regime_tributario,
          capitalSocial:    existente.capital_social,
          dataConsulta:     existente.data_consulta,
          fonte:            "Banco Local",
        });
      }
    }

    // Se somenteBanco=true e não achou, retorna vazio
    if (somenteBanco) {
      return NextResponse.json(null, { status: 404 });
    }

    // Consultas externas em paralelo (chamadas diretas, sem HTTP interno)
    const [receitaResult, radarResult] = await Promise.allSettled([
      getReceitaData(cnpj),
      getRadarData(cnpj),
    ]);

    // Receita Federal é obrigatória
    if (receitaResult.status === "rejected") {
      console.error("Receita Federal falhou:", receitaResult.reason);

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

    // RADAR é opcional — se falhar de verdade (timeout, HTTP não-200, config ausente),
    // marca como ERRO NA CONSULTA (elegível para reconsulta) em vez de fingir "NÃO HABILITADA".
    // Se a chamada teve sucesso mas voltou sem dados, isso é uma resposta de negócio
    // válida e fiel à API — não mexer nesse caminho.
    let radar = {
      situacao: "NÃO HABILITADA",
      submodalidade: "N/A",
      contribuinte: "",
      dataSituacao: "",
    };
    if (radarResult.status === "fulfilled") {
      radar = radarResult.value;
    } else {
      console.error("RADAR falhou:", radarResult.reason?.message);
      radar = {
        situacao: "ERRO NA CONSULTA",
        submodalidade: "",
        contribuinte: "",
        dataSituacao: "",
      };
    }

    const payload = {
      cnpj,
      razao_social: String(receita.razaoSocial || "NÃO ENCONTRADO").toUpperCase(),
      nome_fantasia: String(receita.nomeFantasia || "").toUpperCase(),
      situacao_radar: String(radar.situacao).toUpperCase(),
      submodalidade: String(radar.submodalidade),
      data_situacao: parseDateBR(radar.dataSituacao || receita.situacao),
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
    });
  } catch (error: any) {
    console.error("ERRO CONSULTACOMPLETA:", error.message);
    return NextResponse.json({ error: "Falha interna" }, { status: 500 });
  }
}
