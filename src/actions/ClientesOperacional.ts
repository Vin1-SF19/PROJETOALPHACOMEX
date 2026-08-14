"use server"

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  vincularEmpresaOperacionalSchema,
  cadastrarAcessoOperacionalSchema,
} from "@/lib/validations/operacional";

export async function cadastrarApenasCliente(data: unknown) {
  try {
    const parsed = cadastrarAcessoOperacionalSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: "Dados de acesso inválidos." };
    }

    const emailExiste = await db.clienteOperacional.findUnique({
      where: { email: parsed.data.email }
    });

    if (emailExiste) {
      return { success: false, error: "Este e-mail já está cadastrado em outro acesso." };
    }

    const novoCliente = await db.clienteOperacional.create({
      data: {
        nome: parsed.data.nome,
        email: parsed.data.email,
        senha: parsed.data.senha,
      }
    });

    return { success: true, id: novoCliente.id };
  } catch (error) {
    console.error("Erro ao criar usuário:", error);
    return { success: false, error: "Erro interno ao criar acesso do cliente." };
  }
}

/**
 * Busca uma empresa já cadastrada no CRM (Cliente Master) pelo CNPJ, para
 * pré-visualização antes de vincular ao portal Operacional — Fase 3.5 do
 * Cliente Master. NUNCA consulta a Receita Federal nem cria `Cliente` novo:
 * só lê o que já existe. Se não encontrar, o chamador deve orientar o usuário
 * a cadastrar a empresa no Alpha CRM primeiro.
 */
export async function buscarClienteParaVincularOperacional(cnpj: string) {
  try {
    const cnpjNormalizado = cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (cnpjNormalizado.length < 11) {
      return { success: false, error: "CNPJ incompleto." };
    }

    const cliente = await db.cliente.findUnique({
      where: { cnpj: cnpjNormalizado },
      select: { cnpj: true, razaoSocial: true, nomeFantasia: true },
    });

    if (!cliente) {
      return {
        success: false,
        error: "Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vincular ao Operacional.",
      };
    }

    return { success: true, data: cliente };
  } catch (error) {
    console.error("Erro ao buscar Cliente para vincular ao Operacional:", error);
    return { success: false, error: "Erro ao consultar o CRM." };
  }
}

/**
 * Vincula uma empresa já cadastrada no CRM (Cliente Master) a uma conta de
 * acesso do portal Operacional — Fase 3.5 do Cliente Master. NUNCA cria
 * `Cliente` novo (mesma regra dos demais módulos satélite: BPM é a única
 * porta de entrada de Cliente novo no sistema). Se o CNPJ não existir ainda,
 * bloqueia com mensagem orientando a cadastrar a empresa no Alpha CRM primeiro.
 */
export async function vincularEmpresaAoCliente(dados: unknown) {
  try {
    const parsed = vincularEmpresaOperacionalSchema.safeParse(dados);
    if (!parsed.success) {
      return { success: false, error: "Dados inválidos para vincular a empresa." };
    }
    const cnpjNormalizado = parsed.data.cnpj.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

    const cliente = await db.cliente.findUnique({ where: { cnpj: cnpjNormalizado }, select: { id: true } });
    if (!cliente) {
      return {
        success: false,
        error: "Esta empresa ainda não está cadastrada no CRM — cadastre-a primeiro no Alpha CRM antes de vincular ao Operacional.",
      };
    }

    const acesso = await db.clienteOperacional.findUnique({
      where: { id: parsed.data.clienteOperacionalId },
      select: { id: true },
    });
    if (!acesso) {
      return { success: false, error: "Acesso de cliente não encontrado." };
    }

    await db.operacionalClientes.create({
      data: {
        clienteId: cliente.id,
        clienteOperacionalId: parsed.data.clienteOperacionalId,
        embasamento: "",
        status: "ATIVO",
      }
    });

    revalidatePath("/PainelAlpha/CheckList");
    return { success: true };
  } catch (error) {
    console.error("ERRO NO PRISMA:", error);
    return {
      success: false,
      error: "Erro ao vincular a empresa ao acesso do portal.",
    };
  }
}


export async function verificarCnpjsOperacional(cnpjs: string[]) {
  try {
    const cnpjsLimpos = cnpjs.map((c) => c.replace(/[^A-Za-z0-9]/g, "").toUpperCase());

    const empresasExistentes = await db.operacionalClientes.findMany({
      where: {
        cliente: { cnpj: { in: cnpjsLimpos } }
      },
      include: {
        cliente: {
          select: {
            cnpj: true,
            razaoSocial: true,
            nomeFantasia: true,
          }
        },
        clienteOperacional: {
          select: {
            nome: true,
            email: true
          }
        }
      }
    });

    const dataFormatada = empresasExistentes.map((emp) => ({
      cnpj: emp.cliente.cnpj,
      razaoSocial: emp.cliente.razaoSocial.toUpperCase(),
      nomeFantasia: (emp.cliente.nomeFantasia || "").toUpperCase(),
      status: emp.status,
      embasamento: emp.embasamento,
      progresso: emp.progresso,
      mesProtocolo: emp.mesProtocolo,
      donoNome: emp.clienteOperacional.nome,
      donoEmail: emp.clienteOperacional.email
    }));

    return {
      success: true,
      data: dataFormatada,
      exists: dataFormatada.length > 0
    };
  } catch (error) {
    console.error("Erro ao validar CNPJ no operacional:", error);
    return { success: false, error: "Erro ao consultar banco operacional" };
  }
}
