import "server-only";

import type { Prisma } from "@prisma/client";
import db from "@/lib/prisma";
import { cnpjEhValido, normalizarCNPJ } from "@/lib/format-cnpj";
import { getReceitaData } from "@/lib/cnpj/receita-federal";
import { getEmpresaAquiData } from "@/lib/cnpj/empresa-aqui";
import { consultarRadar, ErroConsultaRadar } from "@/lib/radar/consulta";

type Registro = Record<string, unknown>;

function objeto(valor: unknown): Registro {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : {};
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor.trim() : "";
}

function numeroMonetario(valor: unknown): number | null {
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : null;
  const bruto = String(valor ?? "").replace(/[^\d,.-]/g, "");
  if (!bruto) return null;
  const normalizado = bruto.includes(",") ? bruto.replace(/\./g, "").replace(",", ".") : bruto;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

function regimeEmpresaAqui(dados: Registro): string | null {
  if (["S", "SIM"].includes(texto(dados.opcao_simples).toUpperCase())) return "SIMPLES NACIONAL";
  const historico = Array.isArray(dados.historicoRegimePorAno) ? dados.historicoRegimePorAno : [];
  const ultimo = historico.map((item) => objeto(item))
    .sort((a, b) => Number(b.Ano ?? b.ano ?? 0) - Number(a.Ano ?? a.ano ?? 0))[0];
  const historicoRegime = texto(ultimo?.Regime ?? ultimo?.regime);
  const declarado = texto(dados.regime_tributario).split(";")
    .map((parte) => parte.replace(/ANO\s+\d{4}\s+/i, "").trim()).filter(Boolean).at(-1) ?? "";
  const regime = (historicoRegime || declarado).toUpperCase();
  return regime && !/^(N[ÃA]O INFORMADO|N\/A|NULL|-+)$/.test(regime) ? regime : null;
}

function dividaTributaria(dados: Registro): number | null {
  const valores = Object.entries(dados).filter(([chave]) => /^\d+$/.test(chave))
    .map(([, valor]) => objeto(valor).dividas_valor)
    .map(numeroMonetario)
    .filter((valor): valor is number => valor !== null);
  return valores.length ? valores.reduce((total, valor) => total + valor, 0) : null;
}

function qualificacaoFiscal(regime: string | null, rfb: {
  optante_simples: boolean | null;
  dataConstituicao: string;
}): string | null {
  if (!regime || rfb.optante_simples === null) return null;
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(rfb.dataConstituicao);
  const abertura = partes ? new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1])) : null;
  if (!abertura || Number.isNaN(abertura.getTime())) return null;
  const hoje = new Date();
  const anos = hoje.getFullYear() - abertura.getFullYear()
    - (hoje.getMonth() < abertura.getMonth() || (hoje.getMonth() === abertura.getMonth() && hoje.getDate() < abertura.getDate()) ? 1 : 0);
  if (rfb.optante_simples || anos < 3) return "DESQUALIFICADO";
  if (anos >= 5 && regime.includes("REAL")) return "PREMIUM";
  if (anos >= 3 && (regime.includes("PRESUMIDO") || regime.includes("REAL"))) return "QUALIFICADO";
  return null;
}

/** Consulta independente por fonte. Nenhum erro externo remove um snapshot anterior. */
export async function consultarEGuardarCnpjLead(cnpjInformado: string) {
  const cnpj = normalizarCNPJ(cnpjInformado);
  if (!cnpjEhValido(cnpj)) throw new Error("CNPJ inválido");

  const [receitaResultado, empresaAquiResultado, radarResultado] = await Promise.allSettled([
    getReceitaData(cnpj), getEmpresaAquiData(cnpj), consultarRadar(cnpj, 15_000),
  ]);
  const receita = receitaResultado.status === "fulfilled" ? receitaResultado.value : null;
  const empresaAquiRaw = empresaAquiResultado.status === "fulfilled" ? empresaAquiResultado.value : null;
  const radar = radarResultado.status === "fulfilled" ? radarResultado.value : null;
  const radarNaoHabilitado = radarResultado.status === "rejected"
    && radarResultado.reason instanceof ErroConsultaRadar && radarResultado.reason.status === 404;
  const atual = await db.consultaPreAnalise.findUnique({
    where: { cnpj },
    select: { razaoSocial: true, nomeFantasia: true, situacao: true, uf: true, municipio: true,
      regimeEA: true, qualificacao: true, submodalidade: true, capitalSocial: true,
      dadosBrutos: true, clienteId: true },
  });
  const empresa = await db.cliente.findUnique({
    where: { cnpj }, select: { id: true, razaoSocial: true, nomeFantasia: true, uf: true, municipio: true },
  });
  const anterior = objeto(atual?.dadosBrutos);
  const agora = new Date().toISOString();
  const regimeEA = empresaAquiRaw ? regimeEmpresaAqui(empresaAquiRaw) : null;
  const empresaAqui = empresaAquiRaw ? {
    ...empresaAquiRaw,
    regimeEA,
    regimeReceita: receita?.regimeTributario ?? null,
    historicoRegime: empresaAquiRaw.historicoRegimePorAno ?? null,
    divida_tributaria: dividaTributaria(empresaAquiRaw),
    qualificacao: receita ? qualificacaoFiscal(regimeEA, receita) : null,
  } : null;
  const dadosRadar = radar ? {
    situacao: radar.situacao, modalidade: radar.modalidade,
    submodalidade: radar.submodalidade, dataSituacao: radar.dataSituacao,
    baseLegal: radar.baseLegal, tipoDesabilitacao: radar.tipoDesabilitacao,
    operacoesAutorizadas: radar.operacoesAutorizadas,
  } : radarNaoHabilitado ? { situacao: "NÃO HABILITADA" } : null;
  const falhas = [
    receitaResultado.status === "rejected" ? "Receita Federal" : null,
    empresaAquiResultado.status === "rejected" ? "EmpresaAqui" : null,
    radarResultado.status === "rejected" && !radarNaoHabilitado ? "Radar" : null,
  ].filter((nome): nome is string => Boolean(nome));

  if (receita || empresaAqui || dadosRadar) {
    const dadosBrutos = {
      ...anterior,
      ...(receita ? { rfb: { dados: receita, consultadoEm: agora } } : {}),
      ...(empresaAqui ? { empresaqui: { dados: empresaAqui, consultadoEm: agora } } : {}),
      ...(dadosRadar ? { radar: { dados: dadosRadar, consultadoEm: agora } } : {}),
      consultaCrm: { consultadoEm: agora, falhas },
    } as Prisma.InputJsonValue;
    const razaoSocial = receita?.razaoSocial || atual?.razaoSocial || empresa?.razaoSocial
      || radar?.razaoSocial || texto(empresaAquiRaw?.razao);
    if (razaoSocial) {
      const dadosAtualizados = {
        razaoSocial,
        nomeFantasia: receita?.nomeFantasia || atual?.nomeFantasia || empresa?.nomeFantasia || null,
        situacao: receita?.situacao || atual?.situacao || null,
        uf: receita?.uf || atual?.uf || empresa?.uf || null,
        municipio: receita?.municipio || atual?.municipio || empresa?.municipio || null,
        regimeEA: regimeEA || atual?.regimeEA || null,
        qualificacao: empresaAqui?.qualificacao || atual?.qualificacao || null,
        submodalidade: radarNaoHabilitado ? null : radar?.submodalidade || atual?.submodalidade || null,
        capitalSocial: numeroMonetario(receita?.capitalSocial) ?? atual?.capitalSocial ?? null,
        dadosBrutos,
        clienteId: atual?.clienteId || empresa?.id || null,
      };
      await db.consultaPreAnalise.upsert({
        where: { cnpj }, update: dadosAtualizados,
        create: { cnpj, ...dadosAtualizados },
      });
    }
  }

  return {
    cadastro: receita ? {
      razaoSocial: receita.razaoSocial, nomeFantasia: receita.nomeFantasia,
      uf: receita.uf, municipio: receita.municipio,
    } : null,
    falhas,
    radarSituacao: dadosRadar?.situacao ?? null,
  };
}
