"use server"

import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function cadastrarApenasCliente(data: { nome: string; email: string; senha: string }) {
  try {
    const emailExiste = await db.clienteOperacional.findUnique({
      where: { email: data.email }
    });

    if (emailExiste) {
      return { success: false, error: "Este e-mail já está cadastrado em outro acesso." };
    }

    const novoCliente = await db.clienteOperacional.create({
      data: {
        nome: data.nome,
        email: data.email,
        senha: data.senha,
      }
    });

    return { success: true, id: novoCliente.id };
  } catch (error: any) {
    console.error("Erro ao criar usuário:", error);
    return { success: false, error: "Erro interno ao criar acesso do cliente." };
  }
}

export async function vincularEmpresaAoCliente(formData: any) {
  try {
    const cnpjLimpo = formData.cnpj.replace(/\D/g, '');

    const dadosParaBanco = {
      cnpj: cnpjLimpo,
      razaoSocial: (formData.razaoSocial || "").toUpperCase(),
      nomeFantasia: (formData.nomeFantasia || "").toUpperCase(),
      // Campo legado obrigatorio no banco; a escolha real ocorre no primeiro checklist.
      embasamento: "",
      clienteId: formData.clienteId,

      situacaoRadar: formData.situacaoRadar,
      submodalidade: formData.submodalidade,
      dataSituacao: formData.dataSituacao,
      municipio: formData.municipio,
      uf: formData.uf,
      regimeTributario: formData.regimeTributario,
      capitalSocial: String(formData.capitalSocial || ""),
      dataConstituicao: formData.dataConstituicao,
      contribuinte: formData.contribuinte,

      status: "ATIVO",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.operacionalClientes.create({
      data: dadosParaBanco
    });

    revalidatePath("/PainelAlpha/CheckList");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO PRISMA:", error);
    return {
      success: false,
      error: "Erro de banco: Verifique se o campo updatedAt está configurado."
    };
  }
}


export async function verificarCnpjsOperacional(cnpjs: string[]) {
  try {
    const cnpjsLimpos = cnpjs.map(c => c.replace(/\D/g, ''));

    const empresasExistentes = await db.operacionalClientes.findMany({
      where: {
        cnpj: { in: cnpjsLimpos }
      },
      include: {
        cliente: {
          select: {
            nome: true,
            email: true
          }
        }
      }
    });

    const dataFormatada = empresasExistentes.map((emp) => ({
      cnpj: emp.cnpj,
      razaoSocial: emp.razaoSocial.toUpperCase(),
      nomeFantasia: (emp.nomeFantasia || "").toUpperCase(),
      status: emp.status,
      embasamento: emp.embasamento,
      progresso: emp.progresso,
      mesProtocolo: emp.mesProtocolo,
      regimeTributario: emp.regimeTributario,
      situacaoRadar: emp.situacaoRadar,
      submodalidade: emp.submodalidade,
      dataSituacao: emp.dataSituacao,
      municipio: emp.municipio,
      uf: emp.uf,
      capitalSocial: emp.capitalSocial,
      dataConstituicao: emp.dataConstituicao,
      contribuinte: emp.contribuinte,
      donoNome: emp.cliente.nome,
      donoEmail: emp.cliente.email
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
