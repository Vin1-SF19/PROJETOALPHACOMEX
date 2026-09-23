"use server";

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";
import type { consultas_radar } from "@prisma/client";

type EmpresaRadarEntrada = {
  cnpj?: string | number;
  razao_social?: string;
  razaoSocial?: string;
  nome_fantasia?: string;
  nomeFantasia?: string;
  situacao_radar?: string;
  situacao?: string;
  submodalidade?: string;
  data_situacao?: string | Date | null;
  dataSituacao?: string | Date | null;
  municipio?: string;
  uf?: string;
  data_constituicao?: string | Date | null;
  dataConstituicao?: string | Date | null;
  regime_tributario?: string;
  regimeTributario?: string;
  capital_social?: string | number;
  capitalSocial?: string | number;
  contribuinte?: string;
  data_opcao?: string | Date | null;
  DataSimples?: string | Date | null;
  dataOpcao?: string | Date | null;
  data_consulta?: string | Date | null;
  dataConsulta?: string | Date | null;
};

const parseDateBR = (valor: unknown): Date | null => {
  if (!valor || valor === "" || valor === "N/A") return null;
  if (valor instanceof Date) return isNaN(valor.getTime()) ? null : valor;
  const dataString = String(valor).trim();
  const partes = dataString.split('/');
  if (partes.length === 3) {
    const d = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]), 12, 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }
  const isoDate = new Date(dataString);
  if (!isNaN(isoDate.getTime())) {
    isoDate.setHours(12, 0, 0, 0);
    return isoDate;
  }
  return null;
};

export async function registrarNovoArquivo(nome: string, total: number) {
  try {
    const res = await db.arquivos_radar.create({
      data: {
        nome_arquivo: nome,
        total_registros: total,
        data_upload: new Date()
      }
    });
    return { success: true, id: res.id };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 'P2002') return { success: false, error: "duplicado" };
    return { success: false, error: "Erro ao criar arquivo" };
  }
}

export async function salvarDadosNoBanco(empresas: EmpresaRadarEntrada[], arquivoId?: number) {
  try {
    let novos = 0;
    let existentes = 0;
    const resultadosProcessados: consultas_radar[] = [];

    const promessas = empresas.map(async (emp) => {
      const cnpjLimpo = String(emp.cnpj || "").replace(/\D/g, "").padStart(14, "0").substring(0, 14);
      if (!cnpjLimpo || cnpjLimpo.length < 14) return null;

      const registro = await db.consultas_radar.findUnique({
        where: { cnpj: cnpjLimpo },
        select: { id: true, razao_social: true }
      });

      const jaTemDadosReais = !!(registro && registro.razao_social && registro.razao_social !== "" && registro.razao_social !== "NÃO ENCONTRADO");
      if (jaTemDadosReais) existentes++; else if (!registro) novos++;

      const isApenasCnpj = !emp.razaoSocial && !emp.razao_social;
      if (isApenasCnpj && jaTemDadosReais) return;

      const formatar = (v: unknown) => {
        const d = parseDateBR(v);
        return d ? d.toISOString() : null;
      };

      const payload = {
        razao_social: (emp.razao_social || emp.razaoSocial || "").toUpperCase(),
        nome_fantasia: (emp.nome_fantasia || emp.nomeFantasia || "").toUpperCase(),
        situacao_radar: (emp.situacao_radar || emp.situacao || "").toUpperCase(),
        submodalidade: (emp.submodalidade || "").toUpperCase(),
        data_situacao: formatar(emp.data_situacao || emp.dataSituacao),
        municipio: (emp.municipio || "").toUpperCase(),
        uf: (emp.uf || "").toUpperCase(),
        data_constituicao: formatar(emp.data_constituicao || emp.dataConstituicao),
        regime_tributario: emp.regime_tributario || emp.regimeTributario || "",
        capital_social: String(emp.capital_social || emp.capitalSocial || ""),
        contribuinte: emp.contribuinte || "",
        data_opcao: formatar(emp.data_opcao || emp.DataSimples || emp.dataOpcao),
        arquivo_id: arquivoId || null,
        fonte: isApenasCnpj ? "Importação CNPJ" : "Importação Completa",
        data_consulta: formatar(emp.data_consulta || emp.dataConsulta) || new Date().toISOString(),
        json_completo: JSON.stringify(emp),
      };

      const resultado = await db.consultas_radar.upsert({
        where: { cnpj: cnpjLimpo },
        update: payload,
        create: { cnpj: cnpjLimpo, ...payload }
      });

      resultadosProcessados.push(resultado);
      return resultado;
    });

    await Promise.all(promessas);
    revalidatePath("/PainelAlpha/ConsultarRadar");

    return { success: true, novos, existentes, data: resultadosProcessados };
  } catch (error) {
    return { success: false, novos: 0, existentes: 0, error: error instanceof Error ? error.message : String(error) };
  }
}


export async function salvarPlanilhaCompleta(empresas: EmpresaRadarEntrada[], nomeDoArquivo: string, arquivoIdExistente?: number) {
  if (!empresas || empresas.length === 0) return { success: false };

  try {
    let idDoArquivo = arquivoIdExistente;
    let totalCriados = 0;
    let totalExistentes = 0;

    if (!idDoArquivo) {
      const resArquivo = await registrarNovoArquivo(nomeDoArquivo, empresas.length);
      if (!resArquivo.success || !resArquivo.id) return { success: false, error: resArquivo.error };
      idDoArquivo = resArquivo.id;
    }

    const TAMANHO_LOTE = 20;
    for (let i = 0; i < empresas.length; i += TAMANHO_LOTE) {
      const lote = empresas.slice(i, i + TAMANHO_LOTE);
      const res = await salvarDadosNoBanco(lote, idDoArquivo);
      if (!res.success) {
        return { success: false, error: res.error || "Falha ao salvar lote", idGerado: idDoArquivo, totalCriados, totalExistentes };
      }
      totalCriados += res.novos;
      totalExistentes += res.existentes;
      await new Promise(r => setTimeout(r, 50));
    }

    return { success: true, idGerado: idDoArquivo, totalCriados, totalExistentes };
  } catch (error) {
    return { success: false };
  }
}

export async function salvarConsultaIndividual(empresa: EmpresaRadarEntrada) {
  try {
    const cnpjLimpo = String(empresa.cnpj || "").replace(/\D/g, "");

    if (!empresa.razaoSocial || !empresa.situacao || empresa.situacao === "ERRO") {
      return { success: false, error: "Dados incompletos" };
    }

    const formatarData = (v: unknown) => {
      const d = parseDateBR(v);
      return d ? d.toISOString() : null;
    };

    const payload = {
      razao_social: (empresa.razaoSocial || empresa.razao_social || "").toUpperCase(),
      nome_fantasia: (empresa.nomeFantasia || empresa.nome_fantasia || "").toUpperCase(),
      situacao_radar: empresa.situacao || "",
      submodalidade: empresa.submodalidade || "",
      data_situacao: formatarData(empresa.dataSituacao || empresa.data_situacao),
      municipio: (empresa.municipio || "").toUpperCase(),
      uf: (empresa.uf || "").toUpperCase(),
      data_constituicao: formatarData(empresa.dataConstituicao || empresa.data_constituicao),
      regime_tributario: empresa.regimeTributario || "",
      capital_social: String(empresa.capitalSocial || ""),
      contribuinte: empresa.contribuinte || "",
      data_opcao: formatarData(empresa.data_opcao || empresa.DataSimples),
      json_completo: JSON.stringify(empresa),
      data_consulta: formatarData(empresa.dataConsulta) || new Date().toISOString()
    };

    const registroAtualizado = await db.consultas_radar.upsert({
      where: { cnpj: cnpjLimpo },
      update: payload,
      create: { cnpj: cnpjLimpo, fonte: "Consulta API Automática", ...payload },
    });

    revalidatePath("/PainelAlpha/ConsultarRadar");

    return { success: true, data: registroAtualizado };
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : String(error);
    console.error("Erro ao salvar consulta:", mensagem);
    return { success: false, error: mensagem };
  }
}


export async function deletarRegistrosBanco(cnpjs: string[]) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, error: "Não autorizado", count: 0 };

    const resultado = await db.consultas_radar.deleteMany({
      where: { cnpj: { in: cnpjs } }
    });
    revalidatePath("/PainelAlpha/HabilitacaoRadar");
    return { success: true, count: resultado.count };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro ao excluir", count: 0 };
  }
}

export async function excluirCnpjsEmLote(ids: number[]) {
  try {
    const resultado = await db.consultas_radar.deleteMany({
      where: { id: { in: ids } }
    });
    revalidatePath("/PainelAlpha/ConsultarRadar");
    return { success: true, count: resultado.count };
  } catch {
    return { success: false };
  }
}

export async function prepararReconsultaLote(tipo: 'ERROS' | 'NAO_HABILITADOS') {
  try {
    const condicao = tipo === 'ERROS'
      ? { situacao_radar: { in: ["ERRO", "ERRO NA API", "NÃO LOCALIZADO", "PENDENTE RADAR", "ERRO NA CONSULTA", ""] } }
      : { situacao_radar: { in: ["NÃO HABILITADA"] } };

    const deletados = await db.consultas_radar.deleteMany({
      where: condicao
    });

    revalidatePath("/PainelAlpha/ConsultarRadar");
    return { success: true, count: deletados.count };
  } catch (error) {
    return { success: false };
  }
}

export async function verificarCnpjsExistentes(cnpjs: string[]) {
  try {
    const empresasNoBanco = await db.consultas_radar.findMany({
      where: { cnpj: { in: cnpjs } }
    });

    const formatar = (valor: unknown) => {
      if (!valor) return null;
      return new Date(valor instanceof Date ? valor : String(valor)).toISOString();
    };

    const dataFormatada = empresasNoBanco.map((emp) => ({
      cnpj: emp.cnpj,
      razaoSocial: (emp.razao_social || "").toUpperCase(),
      nomeFantasia: (emp.nome_fantasia || "").toUpperCase(),
      situacao: (emp.situacao_radar || "").toUpperCase(),
      submodalidade: (emp.submodalidade || "").toUpperCase(),
      dataSituacao: emp.data_situacao,
      municipio: (emp.municipio || "").toUpperCase(),
      uf: (emp.uf || "").toUpperCase(),
      dataConstituicao: emp.data_constituicao,
      regimeTributario: emp.regime_tributario || "",
      capitalSocial: String(emp.capital_social || ""),
      contribuinte: emp.contribuinte || "",
      dataOpcao: emp.data_opcao,
      dataConsulta: emp.data_consulta
    }));

    return { success: true, data: dataFormatada };
  } catch (error) {
    console.error("Erro ao validar banco:", error);
    return { success: false, error: "Erro ao validar banco" };
  }
}
