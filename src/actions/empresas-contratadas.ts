"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import db from "@/lib/prisma";
import { exigirAcessoModulo, getSessaoGeradorDocumentos } from "@/lib/gerador-documentos/ownership";
import {
  EmpresaContratadaSchema,
  AtualizarEmpresaContratadaSchema,
} from "@/lib/gerador-documentos/schemas";
import { getReceitaData } from "@/app/api/ReceitaFederal/route";

const ROTA_BASE = "/PainelAlpha/GeradorDocumentos";
const getSessao = getSessaoGeradorDocumentos;

function mensagemErro(error: unknown): string {
  if (error instanceof z.ZodError) return "Dados inválidos";
  if (error instanceof Error) {
    if (["Não autenticado", "Não autorizado", "Empresa não encontrada", "CNPJ já cadastrado"].includes(error.message)) {
      return error.message;
    }
  }
  return "Não foi possível concluir a operação";
}

export async function CriarEmpresaContratada(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    await exigirAcessoModulo(userId, role);
    const input = EmpresaContratadaSchema.parse(payload);

    const existente = await db.empresaContratada.findUnique({ where: { cnpj: input.cnpj }, select: { id: true } });
    if (existente) return { success: false as const, error: "CNPJ já cadastrado" };

    const empresa = await db.empresaContratada.create({
      data: { ...input, criadoPorId: userId },
    });

    revalidatePath(ROTA_BASE);
    return { success: true as const, empresaId: empresa.id };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ListarEmpresasContratadas() {
  try {
    const { userId, role } = await getSessao();
    await exigirAcessoModulo(userId, role);

    const empresas = await db.empresaContratada.findMany({
      where: { status: "ATIVO" },
      orderBy: { razaoSocial: "asc" },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        logradouro: true,
        numero: true,
        bairro: true,
        municipio: true,
        uf: true,
        cep: true,
        naturezaJuridica: true,
      },
    });

    return { success: true as const, data: empresas };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error), data: [] };
  }
}

export async function AtualizarEmpresaContratada(payload: unknown) {
  try {
    const { userId, role } = await getSessao();
    await exigirAcessoModulo(userId, role);
    const input = AtualizarEmpresaContratadaSchema.parse(payload);
    const { empresaId, ...dados } = input;

    const empresa = await db.empresaContratada.findUnique({ where: { id: empresaId }, select: { id: true } });
    if (!empresa) return { success: false as const, error: "Empresa não encontrada" };

    if (dados.cnpj) {
      const duplicado = await db.empresaContratada.findFirst({
        where: { cnpj: dados.cnpj, id: { not: empresaId } },
        select: { id: true },
      });
      if (duplicado) return { success: false as const, error: "CNPJ já cadastrado" };
    }

    await db.empresaContratada.update({ where: { id: empresaId }, data: dados });

    revalidatePath(ROTA_BASE);
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: mensagemErro(error) };
  }
}

export async function ConsultarCnpjParaQualificacao(cnpjInput: string) {
  try {
    const { userId, role } = await getSessao();
    await exigirAcessoModulo(userId, role);

    const cnpj = cnpjInput.replace(/\D/g, "");
    if (cnpj.length !== 14) return { success: false as const, error: "CNPJ deve conter 14 dígitos" };

    const dados = await getReceitaData(cnpj);

    return {
      success: true as const,
      data: {
        razaoSocial: dados.razaoSocial,
        nomeFantasia: dados.nomeFantasia === "SEM NOME FANTASIA" ? "" : dados.nomeFantasia,
        cnpj: dados.cnpj,
        logradouro: dados.logradouro,
        numero: dados.numero,
        bairro: dados.bairro,
        municipio: dados.municipio,
        uf: dados.uf,
        cep: dados.cep,
        naturezaJuridica: dados.natureza_juridica,
      },
    };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Erro ao consultar CNPJ" };
  }
}
