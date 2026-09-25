"use server";

import { auth } from "../../../auth";
import db from "@/lib/prisma";
import { exigirAcessoBpmCard } from "@/lib/bpm/ownership";
import { getReceitaData } from "@/lib/cnpj/receita-federal";
import { cnpjEhValido } from "@/lib/format-cnpj";

export async function ConsultarCnpjNovoContrato(cardId: string, cnpjInformado?: string) {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false as const, error: "Não autorizado" };
    await exigirAcessoBpmCard(cardId, Number(session.user.id), session.user.role ?? null, "editarCard");
    const card = await db.bpmCard.findUnique({
      where: { id: cardId },
      select: {
        pipeline: { select: { chave: true } },
        etapa: { select: { chave: true } },
        empresa: { select: { cnpj: true } },
      },
    });
    if (!card || card.pipeline.chave !== "financeiro" || card.etapa.chave !== "solicitacao_contrato") {
      return { success: false as const, error: "Card fora da etapa Novo contrato" };
    }
    const cnpj = cnpjInformado?.trim() || card.empresa.cnpj || "";
    if (!cnpjEhValido(cnpj)) return { success: false as const, error: "CNPJ inválido" };
    const dados = await getReceitaData(cnpj);
    return {
      success: true as const,
      data: {
        razaoSocial: dados.razaoSocial,
        rua: dados.logradouro,
        numero: dados.numero,
        complemento: dados.complemento,
        bairro: dados.bairro,
        cep: dados.cep,
        municipio: dados.municipio,
        estado: dados.uf,
      },
    };
  } catch {
    return { success: false as const, error: "Não foi possível consultar o CNPJ" };
  }
}
