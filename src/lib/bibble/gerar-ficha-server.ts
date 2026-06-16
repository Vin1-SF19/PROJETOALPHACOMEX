import React from "react";
import path from "path";
import fs from "fs";
import { renderToBuffer } from "@react-pdf/renderer";
import { FichaAlphaPDF } from "@/components/GerarFicha";
import { put } from "@vercel/blob";
import { getReceitaData } from "@/app/api/ReceitaFederal/route";
import db from "@/lib/prisma";
import { upsertConsulta } from "@/actions/PreAnalise";

export interface GerarFichaParams {
  cnpj: string;
  userName?: string;
  nomeResponsavel?: string;
  observacoes?: string;
  dataSituacao?: string;
  horaSituacao?: string;
  tipoRevisao?: string; // "150k", "ilimitado", etc.
}

export interface GerarFichaResult {
  url: string;
  fileName: string;
  razaoSocial: string;
  cnpj: string;
}

export async function gerarFichaServer(params: GerarFichaParams): Promise<GerarFichaResult> {
  const cnpj = params.cnpj.replace(/\D/g, "");
  if (!cnpj || cnpj.length !== 14) {
    throw new Error("CNPJ inválido");
  }

  const userName = params.userName ?? "Operador";

  // 1. Buscar dados RFB
  const rfbDados = await getReceitaData(cnpj) as Record<string, unknown>;

  // 2. Buscar RADAR do cache local
  const radarCached = await db.consultas_radar.findUnique({ where: { cnpj } });
  const radarDados = radarCached
    ? {
        submodalidade: radarCached.submodalidade,
        situacao: radarCached.situacao_radar,
        dataSituacao: radarCached.data_situacao,
      }
    : {};

  // 3. Buscar EmpresaQui do cache
  const preAnalise = await db.consultaPreAnalise.findUnique({
    where: { cnpj },
    select: { regimeEA: true, qualificacao: true },
  });
  const empresaquiDados = preAnalise
    ? { regimeEA: preAnalise.regimeEA, qualificacao: preAnalise.qualificacao }
    : {};

  // 4. Montar payload
  const dados = {
    rfb: { dados: rfbDados },
    empresaqui: { dados: empresaquiDados },
    radar: radarDados,
    extra: {
      nomeResponsavel: params.nomeResponsavel ?? "",
      observacoes: params.observacoes ?? "",
      dataSituacao: params.dataSituacao ?? "",
      horaSituacao: params.horaSituacao ?? "",
      origemLead: "",
      origemLeadDetalhe: "",
      telefone: "",
      mesProtocolo: "",
    },
  };

  // 5. Gerar PDF — no servidor o react-pdf interpreta um caminho de arquivo do Windows
  //    (ex: "C:\...") como esquema de URL e silenciosamente NÃO renderiza a imagem.
  //    Lemos o arquivo e passamos como data URI base64 (resolução cross-platform garantida).
  let logoSrc: string | undefined;
  try {
    const logoFile = path.resolve(process.cwd(), "public", "LogoTipo02.png");
    const logoBuffer = fs.readFileSync(logoFile);
    logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    logoSrc = undefined; // componente cai no fallback "/LogoTipo02.png"
  }

  const element = React.createElement(FichaAlphaPDF, { dados, userLogado: userName, logoPath: logoSrc });
  const buffer = await renderToBuffer(element as Parameters<typeof renderToBuffer>[0]);

  // 6. Upload para Vercel Blob
  const razaoSocial = String((rfbDados as { razaoSocial?: string }).razaoSocial ?? "empresa")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .substring(0, 40);
  const fileName = `fichas/${cnpj}-${razaoSocial}-${Date.now()}.pdf`;

  const { url } = await put(fileName, buffer, {
    access: "public",
    token: process.env.BLOB_READ_WRITE_TOKEN,
  });

  // 7. Salvar no banco (não bloqueia em caso de erro)
  await upsertConsulta({
    rfb: { dados: rfbDados },
    empresaqui: { dados: empresaquiDados },
    radar: { dados: radarDados },
    extra: {
      nomeResponsavel: params.nomeResponsavel,
      observacoes: params.observacoes,
      tipoRevisao: params.tipoRevisao,
    },
  }).catch(() => {});

  return {
    url,
    fileName: `Ficha_${razaoSocial}.pdf`,
    razaoSocial: (rfbDados as { razaoSocial?: string }).razaoSocial ?? "Empresa",
    cnpj,
  };
}
