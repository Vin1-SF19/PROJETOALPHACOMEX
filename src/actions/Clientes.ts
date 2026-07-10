"use server"
import db from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";

async function getColaboradorNome(): Promise<string> {
  const session = await auth();
  const u = session?.user as { nome?: string; usuario?: string } | undefined;
  return u?.nome || u?.usuario || "Sistema";
}

export async function verificarCNPJDuplicado(cnpj: string): Promise<{ existe: boolean; razaoSocial?: string }> {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  try {
    const cliente = await db.clientes.findFirst({
      where: { cnpj: cnpjLimpo },
      select: { razaoSocial: true },
    });
    return { existe: !!cliente, razaoSocial: cliente?.razaoSocial };
  } catch {
    return { existe: false };
  }
}

export async function CadastrarCliente(dados: any, socios: any[]) {
  try {
    const res = await db.clientes.create({
      data: {
        cnpj: dados.cnpj.replace(/\D/g, ""),
        razaoSocial: dados.razaoSocial || "",
        nomeFantasia: dados.nomeFantasia || "",
        dataConstituicao: dados.dataConstituicao || "",
        uf: dados.uf || "",
        regimeTributario: dados.regimeTributario || "",
        servicos: Array.isArray(dados.servicos) ? dados.servicos.join(", ") : dados.servicos,
        analistaResponsavel: dados.analistaResponsavel || "",
        embasamento: dados.embasamento || null,
        origemLead: dados.origemLead || null,
        dataContratacao: dados.dataContratacao ? new Date(dados.dataContratacao).toISOString() : null,
        dataExito: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        socios: {
          create: socios.map(s => ({
            nome: s.nome,
            telefone: s.telefone || "",
            obs: s.obs || "",
            dataNascimento: s.dataNascimento || "",
            vinculo: s.vinculo
          }))
        }
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO CADASTRO:", error.message);
    if (error.code === 'P2002') return { success: false, error: "CNPJ já existe!" };
    return { success: false, error: "Erro na base de dados. Verifique os campos." };
  }
}


export async function buscarClientes() {
  try {
    const lista = await db.clientes.findMany({
      where: {
        status: {
          not: "Arquivado"
        }
      },
      include: {
        socios: true,
        log_cs: {
          orderBy: { dataRegistro: 'desc' },
        },
        logFeedback: {
          orderBy: { dataRegistro: 'desc' },
        },
        indicacao: {
          where: { status: "ATIVA" },
          include: { parceiro: { select: { id: true, nome: true, nivel: true } } },
        },
      },
      orderBy: { createdAt: 'desc' }
    });
    return lista;
  } catch (error: any) {
    console.error("ERRO DO PRISMA buscarClientes:", error?.message ?? error);
    throw error;
  }
}

/**
 * Busca todos os Contratos Comerciais (módulo Metas/Comercial) daquele CNPJ,
 * mais recente primeiro. Um mesmo CNPJ pode ter vários contratos (serviços
 * diferentes vendidos em momentos diferentes) — no Comercial eles continuam
 * como linhas separadas; aqui mesclamos só para exibição no card do CS&NPS.
 * Casamento por CNPJ normalizado (só dígitos), pois os dois lados podem salvar
 * o CNPJ com/sem máscara.
 */
export async function buscarServicosContratados(cnpj: string) {
  const cnpjLimpo = cnpj.replace(/\D/g, "");
  if (!cnpjLimpo) return [];

  try {
    const contratos = await db.contratoComercial.findMany({
      where: { arquivado: false },
      select: {
        id: true,
        cnpj: true,
        servico: true,
        valorContrato: true,
        formaPagamento: true,
        closerNome: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return contratos
      .filter((c) => c.cnpj.replace(/\D/g, "") === cnpjLimpo)
      .map(({ cnpj: _cnpj, ...resto }) => resto);
  } catch (error: any) {
    console.error("ERRO buscarServicosContratados:", error?.message ?? error);
    return [];
  }
}

export async function salvarLogCS(clienteId: number, dados: { sentimento: string, observacao: string, data_registro: string }) {
  try {
    const colaborador = await getColaboradorNome();
    await db.$executeRawUnsafe(
      `INSERT INTO log_cs (colaborador, sentimento, observacao, clienteId, dataRegistro)
         VALUES (?, ?, ?, ?, ?)`,
      colaborador,
      dados.sentimento,
      dados.observacao,
      clienteId,
      dados.data_registro 
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO SQL AO SALVAR CS:", error.message);
    return { success: false, error: "Erro crítico no banco." };
  }
}

export async function atualizarDadosGestao(clienteId: number, dados: any) {
  try {
    await db.clientes.update({
      where: { id: clienteId },
      data: {
        nps: Number(dados.nps),
        feedbackGoogle: Boolean(dados.feedbackGoogle),
        nomeGoogle: dados.nomeGoogle,
        status: dados.status
      }
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error) {
    return { success: false };
  }
}

export async function salvarLogFeedback(clienteId: number, dados: any) {
  try {
    const colaborador = await getColaboradorNome();
    const sentimento = dados.sentimento || "N/A";
    const observacao = dados.observacao || "";
    const dataRegistro = dados.data_registro; 

    await db.$executeRawUnsafe(
      `INSERT INTO logFeedback (colaborador, sentimento, observacao, clienteId, dataRegistro) 
       VALUES (?, ?, ?, ?, ?)`,
      colaborador,
      sentimento,
      observacao,
      Number(clienteId),
      dataRegistro 
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO CRÍTICO FEEDBACK:", error.message);
    return { success: false, error: error.message };
  }
}

export async function salvarAlteracoesGestao(clienteId: number, novosDados: any) {
  try {
    const colaborador = await getColaboradorNome();
    const estadoAntesDaMudanca = await db.clientes.findUnique({
      where: { id: clienteId }
    });

    if (!estadoAntesDaMudanca) return { success: false, error: "Cliente não encontrado" };

    await db.logAlteracao.create({
      data: {
        clienteId: clienteId,
        colaborador: colaborador,
        acao: "Edição de Dados",
        dadosAnteriores: JSON.stringify(estadoAntesDaMudanca)
      }
    });

    const dataFormatadaExito =
      novosDados.status === "Deferido"
        ? (novosDados.dataExito ?? null)
        : null;



    await db.clientes.update({
      where: { id: clienteId },
      data: {
        cnpj: novosDados.cnpj?.replace(/\D/g, ""),
        razaoSocial: novosDados.razaoSocial,
        nomeFantasia: novosDados.nomeFantasia,
        dataConstituicao: novosDados.dataConstituicao,
        regimeTributario: novosDados.regimeTributario,
        uf: novosDados.uf,
        status: novosDados.status,
        nps: (novosDados.nps === "" || novosDados.nps === null) ? null : Number(novosDados.nps),
        feedbackGoogle: novosDados.feedbackGoogle,
        nomeGoogle: novosDados.nomeGoogle,
        dataExito: dataFormatadaExito,
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("Erro na Auditoria:", error.message);
    return { success: false, error: error.message };
  }
}



export async function restaurarVersaoCliente(clienteId: number, jsonAntigo: string) {
  try {
    const dadosBrutos = JSON.parse(jsonAntigo);

    const {
      id,
      createdAt,
      updatedAt,
      log_cs,
      logFeedback,
      logAlteracao,
      socios,
      ...dadosLimpos
    } = dadosBrutos;

    if (dadosLimpos.dataContratacao) dadosLimpos.dataContratacao = new Date(dadosLimpos.dataContratacao).toISOString();
    if (dadosLimpos.dataExito) dadosLimpos.dataExito = new Date(dadosLimpos.dataExito).toISOString();
    if (dadosLimpos.dataConstituicao) dadosLimpos.dataConstituicao = new Date(dadosLimpos.dataConstituicao).toISOString();

    const colaborador = await getColaboradorNome();
    const estadoAtualParaLog = await db.clientes.findUnique({ where: { id: clienteId } });

    await db.clientes.update({
      where: { id: clienteId },
      data: {
        ...dadosLimpos,
        logAlteracao: {
          create: {
            colaborador: colaborador,
            acao: "Restauração de Backup",
            dadosAnteriores: JSON.stringify(estadoAtualParaLog)
          }
        }
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO RESTORE:", error.message);
    return { success: false, error: error.message };
  }
}

export async function salvarAlteracoesGeral(clienteId: number, dadosNovos: any) {
  try {
    const colaborador = await getColaboradorNome();
    const estadoAnterior = await db.clientes.findUnique({ where: { id: clienteId } });

    await db.clientes.update({
      where: { id: clienteId },
      data: {
        analistaResponsavel: dadosNovos.analistaResponsavel,
        dataContratacao: dadosNovos.dataContratacao ? new Date(dadosNovos.dataContratacao).toISOString() : null,
        status: dadosNovos.status,
        nps: (dadosNovos.nps === "" || dadosNovos.nps === null) ? null : Number(dadosNovos.nps),
        feedbackGoogle: dadosNovos.feedbackGoogle,
        nomeGoogle: dadosNovos.nomeGoogle,
        cnpj: dadosNovos.cnpj?.replace(/\D/g, ""),
        razaoSocial: dadosNovos.razaoSocial,
        nomeFantasia: dadosNovos.nomeFantasia,
        dataConstituicao: dadosNovos.dataConstituicao,
        regimeTributario: dadosNovos.regimeTributario,
        uf: dadosNovos.uf,
        servicos: Array.isArray(dadosNovos.servicos) ? dadosNovos.servicos.join(", ") : dadosNovos.servicos,
        embasamento: dadosNovos.embasamento ?? null,
        origemLead: dadosNovos.origemLead ?? null,
        dataExito: dadosNovos.dataExito ? new Date(dadosNovos.dataExito).toISOString() : (dadosNovos.status === "Deferido" ? new Date().toISOString() : null),
        updatedAt: new Date().toISOString(),
      }
    });

    await db.logAlteracao.create({
      data: {
        clienteId: clienteId,
        colaborador: colaborador,
        acao: "Edição Geral de Dados",
        dadosAnteriores: JSON.stringify(estadoAnterior)
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO NO UPDATE:", error.message);
    return { success: false, error: error.message };
  }
}





export async function adicionarSocio(clienteId: number, dadosSocio: { nome: string; telefone?: string; obs?: string, dataNascimento: string, vinculo: string }) {
  try {
    const novoSocio = await db.socios.create({
      data: {
        clienteId: clienteId,
        nome: dadosSocio.nome,
        telefone: dadosSocio.telefone || "",
        obs: dadosSocio.obs || "",
        dataNascimento: dadosSocio.dataNascimento || "",
        vinculo: dadosSocio.vinculo,
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true, data: novoSocio };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


export async function excluirLogCS(logId: number) {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM log_cs WHERE id = ?`,
      logId
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO EXCLUIR LOG CS:", error.message);
    return { success: false, error: "Não foi possível excluir o registro." };
  }
}


export async function excluirLogFeedback(logId: number) {
  try {
    await db.$executeRawUnsafe(
      `DELETE FROM logFeedback WHERE id = ?`, 
      logId
    );

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO EXCLUIR FEEDBACK:", error.message);
    return { success: false };
  }
}

export async function atualizarSocio(socioId: number, dados: { nome: string; telefone?: string; dataNascimento?: string; vinculo?: string; obs?: string }) {
  try {
    await db.socios.update({
      where: { id: socioId },
      data: dados,
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function atualizarLogCS(logId: number, dados: { sentimento: string; observacao: string; dataRegistro?: string }) {
  try {
    await db.log_cs.update({
      where: { id: logId },
      data: {
        sentimento: dados.sentimento,
        observacao: dados.observacao,
        ...(dados.dataRegistro ? { dataRegistro: new Date(`${dados.dataRegistro}T12:00:00`) } : {}),
      },
    });
    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function atualizarStatusCliente(clienteId: number, novoStatus: string) {
  try {
    await db.clientes.update({
      where: { id: clienteId },
      data: {
        status: novoStatus, 
        updatedAt: new Date().toISOString(),
      }
    });

    revalidatePath("/PainelAlpha/CadastroClientes");
    return { success: true };
  } catch (error: any) {
    console.error("ERRO AO OCULTAR:", error.message);
    return { success: false };
  }
}
