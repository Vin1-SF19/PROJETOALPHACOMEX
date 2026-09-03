"use server"

import db from "@/lib/prisma";
import { startOfMonth, startOfDay, endOfDay, endOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "../../auth";
import { podeGerenciarMetas } from "@/lib/metas-permissoes";

function contagem(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? Math.max(0, Math.trunc(numero)) : 0;
}

/**
 * TI, Admin, CEO e Lider Comercial podem consultar leads de qualquer closer;
 * um closer comum só pode consultar os próprios (identificados por nome/usuario,
 * mesmo campo usado como `colaboradoraId` em `upsertPerformance`).
 */
async function exigirAcessoColaborador(colaboradoraId: string) {
  const session = await auth();
  const u = session?.user as { nome?: string; usuario?: string; role?: string } | undefined;
  if (!u) throw new Error("Não autenticado");

  const proprioId = u.nome || u.usuario || "Sistema";
  if (colaboradoraId === proprioId) return;
  if (podeGerenciarMetas(u.role ?? "")) return;

  throw new Error("Acesso negado: você só pode visualizar os próprios leads.");
}

/** Visão de equipe completa (todas as closers) restrita a TI/Admin/CEO/Lider Comercial. */
async function exigirAcessoEquipe() {
  const session = await auth();
  const u = session?.user as { role?: string } | undefined;
  if (!u) throw new Error("Não autenticado");
  if (!podeGerenciarMetas(u.role ?? "")) {
    throw new Error("Acesso negado: apenas TI, Admin, CEO ou Lider Comercial podem visualizar a equipe completa.");
  }
}

/**
 * Lista as closers ativas que podem ser consultadas na tela operacional do
 * Alpha Leads. A lista é protegida pelo mesmo gate das consultas de equipe.
 */
export async function listarClosersAlphaLeads() {
  await exigirAcessoEquipe();

  return db.usuarios.findMany({
    where: {
      status: "ATIVO",
      role: { in: ["COMERCIAL", "Lider Comercial"] },
    },
    select: { id: true, nome: true },
    orderBy: { nome: "asc" },
  });
}

const ColaboradorDataSchema = z.object({
  colaboradoraId: z.string().min(1),
  data: z.coerce.date(),
});

export async function getPerformanceColaborador(colaboradoraId: string, data: Date) {
  const input = ColaboradorDataSchema.parse({ colaboradoraId, data });
  await exigirAcessoColaborador(input.colaboradoraId);

  try {
    const registros = await db.comercialPerformance.findMany({
      where: {
        colaboradoraId: input.colaboradoraId,
        dataRegistro: {
          gte: startOfDay(input.data),
          lte: endOfDay(input.data),
        },
      },
    });

    return registros;
  } catch (error) {
    console.error("Erro ao buscar performance:", error);
    return [];
  }
}

export async function upsertPerformance(dados: any) {
  try {
    const session = await auth();
    const u = session?.user as { nome?: string; usuario?: string } | undefined;
    const colaboradoraId = u?.nome || u?.usuario;
    if (!colaboradoraId) {
      return { success: false, error: "Usuário não autenticado." };
    }

    const dataNormalizada = startOfDay(new Date(dados.dataRegistro));

    const registro = await db.comercialPerformance.upsert({
      where: {
        performance_pk: {
          dataRegistro: dataNormalizada,
          colaboradoraId: colaboradoraId,
          canal: dados.canal,
          servico: dados.servico,
        },
      },
      update: {
        leadsRecebidos: contagem(dados.leadsRecebidos),
        leadsDesqualificados: contagem(dados.leadsDesqualificados),
        reunioesAgendadas: contagem(dados.reunioesAgendadas),
        reunioesRealizadas: contagem(dados.reunioesRealizadas),
        noShow: contagem(dados.noShow),
        contratosHabilitacao: contagem(dados.contratosHabilitacao),
        contratosRevisao: contagem(dados.contratosRevisao),
        HotLeadsHabilitacao: contagem(dados.HotLeadsHabilitacao),
        HotLeadsRevisao: contagem(dados.HotLeadsRevisao),
      },
      create: {
        dataRegistro: dataNormalizada,
        colaboradoraId: colaboradoraId,
        canal: dados.canal,
        servico: dados.servico,
        leadsRecebidos: contagem(dados.leadsRecebidos),
        leadsDesqualificados: contagem(dados.leadsDesqualificados),
        reunioesAgendadas: contagem(dados.reunioesAgendadas),
        reunioesRealizadas: contagem(dados.reunioesRealizadas),
        noShow: contagem(dados.noShow),
        contratosHabilitacao: contagem(dados.contratosHabilitacao),
        contratosRevisao: contagem(dados.contratosRevisao),
        HotLeadsHabilitacao: contagem(dados.HotLeadsHabilitacao),
        HotLeadsRevisao: contagem(dados.HotLeadsRevisao),
      },
    });

    revalidatePath("/PainelAlpha/ControleLeads/Lancamentos");
    return { success: true, data: registro };
  } catch (error) {
    console.error("Erro ao salvar performance:", error);
    return { success: false, error: "Falha ao sincronizar com o banco." };
  }
}

const PerformanceDiariaSchema = z.object({
  colaboradoraId: z.string().min(1),
  data: z.coerce.date(),
  canal: z.string().min(1),
});

export async function getPerformanceDiaria(colaboradoraId: string, data: Date, canal: string) {
  const input = PerformanceDiariaSchema.parse({ colaboradoraId, data, canal });
  await exigirAcessoColaborador(input.colaboradoraId);

  try {
    const registros = await db.comercialPerformance.findMany({
      where: {
        colaboradoraId: input.colaboradoraId,
        canal: input.canal,
        dataRegistro: {
          gte: startOfDay(new Date(data)),
          lte: endOfDay(new Date(data)),
        },
      },
    });

    return registros.reduce((acc, reg) => ({
      leads_recebidos: acc.leads_recebidos + contagem(reg.leadsRecebidos),
      leads_desqualificados: acc.leads_desqualificados + contagem(reg.leadsDesqualificados),
      reunioes_agendadas: acc.reunioes_agendadas + contagem(reg.reunioesAgendadas),
      reunioes_realizadas: acc.reunioes_realizadas + contagem(reg.reunioesRealizadas),
      no_show: acc.no_show + contagem(reg.noShow),
      contratos_Habilit: acc.contratos_Habilit + contagem(reg.contratosHabilitacao),
      contratos_Revisao: acc.contratos_Revisao + contagem(reg.contratosRevisao),
      
      HotLeadsHabilitacao: acc.HotLeadsHabilitacao + contagem(reg.HotLeadsHabilitacao),
      HotLeadsRevisao: acc.HotLeadsRevisao + contagem(reg.HotLeadsRevisao)
    }), {
      leads_recebidos: 0, leads_desqualificados: 0, reunioes_agendadas: 0,
      reunioes_realizadas: 0, no_show: 0, contratos_Habilit: 0, contratos_Revisao: 0,
      HotLeadsHabilitacao: 0, HotLeadsRevisao: 0 
    });
  } catch (error) {
    console.error(error);
    return null;
  }
}

const MesAnoSchema = z.object({
  mes: z.number().int().min(0).max(11),
  ano: z.number().int().min(2000).max(2100),
});

export async function getPerformanceAcumulada(colaboradoraId: string, mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  const colaboradoraIdValidado = z.string().min(1).parse(colaboradoraId);
  await exigirAcessoColaborador(colaboradoraIdValidado);

  try {
    const dataReferencia = new Date(anoValidado, mesValidado, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    const registrosMes = await db.comercialPerformance.findMany({
      where: {
        colaboradoraId,
        dataRegistro: {
          gte: inicioMes,
          lte: fimMes
        }
      }
    });

    const soma = (regs: any[]) => regs.reduce((acc, reg) => ({
      leads: acc.leads + contagem(reg.leadsRecebidos),
      leadsDesqualificados: acc.leadsDesqualificados + contagem(reg.leadsDesqualificados),
      agendadas: acc.agendadas + contagem(reg.reunioesAgendadas),
      realizadas: acc.realizadas + contagem(reg.reunioesRealizadas),
      noShow: acc.noShow + contagem(reg.noShow),
      habilitacao: acc.habilitacao + contagem(reg.contratosHabilitacao),
      revisao: acc.revisao + contagem(reg.contratosRevisao),
      HotLeadsHabilitacao: acc.HotLeadsHabilitacao + contagem(reg.HotLeadsHabilitacao),
      HotLeadsRevisao: acc.HotLeadsRevisao + contagem(reg.HotLeadsRevisao)
    }), { 
      leads: 0, 
      leadsDesqualificados: 0, 
      agendadas: 0, 
      realizadas: 0, 
      noShow: 0, 
      habilitacao: 0, 
      revisao: 0, 
      HotLeadsHabilitacao: 0, 
      HotLeadsRevisao: 0 
    });

    return {
      canais: {
        TRAFEGO_PAGO: soma(registrosMes.filter(r => r.canal === "TRAFEGO_PAGO")),
        CALLIX: soma(registrosMes.filter(r => r.canal === "CALLIX")),
        INDICACAO: soma(registrosMes.filter(r => r.canal === "INDICACAO")),
        EVENTOS: soma(registrosMes.filter(r => r.canal === "EVENTOS")),
        CHINA: soma(registrosMes.filter(r => r.canal === "CHINA")),
      }
    };
  } catch (error) {
    console.error("Erro no acumulado:", error);
    const vazio = { leads: 0, leadsDesqualificados: 0, agendadas: 0, realizadas: 0, noShow: 0, habilitacao: 0, revisao: 0, HotLeadsHabilitacao: 0, HotLeadsRevisao: 0 };
    return {
      canais: {
        TRAFEGO_PAGO: vazio,
        CALLIX: vazio,
        INDICACAO: vazio,
        EVENTOS: vazio,
        CHINA: vazio
      }
    };
  }
}

/**
 * Dias que possuem ao menos um lançamento real no Alpha Leads.
 * O calendário usa a própria performance como fonte da verdade, evitando que
 * um dia seja marcado como concluído sem que os números tenham sido salvos.
 */
export async function getDiasComLancamento(colaboradoraId: string, mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  const colaboradoraIdValidado = z.string().min(1).parse(colaboradoraId);
  await exigirAcessoColaborador(colaboradoraIdValidado);

  const dataReferencia = new Date(anoValidado, mesValidado, 1);
  const registros = await db.comercialPerformance.findMany({
    where: {
      colaboradoraId: colaboradoraIdValidado,
      dataRegistro: {
        gte: startOfMonth(dataReferencia),
        lte: endOfMonth(dataReferencia),
      },
    },
    select: { dataRegistro: true },
    orderBy: { dataRegistro: "asc" },
  });

  return Array.from(
    new Set(registros.map(({ dataRegistro }) => dataRegistro.toISOString().slice(0, 10))),
  );
}

export async function getPerformanceEquipeCompleta(mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  await exigirAcessoEquipe();

  try {
    const dataReferencia = new Date(anoValidado, mesValidado, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    
    const registros = await db.comercialPerformance.findMany({
      where: {
        dataRegistro: {
          gte: inicioMes,
          lte: fimMes
        }
      }
    });

    const agrupado = registros.reduce((acc: any, reg) => {
      const id = reg.colaboradoraId; 
      
      if (!acc[id]) {
        acc[id] = {
          id: id,
          nome: id,
          leads: 0,
          agendadas: 0,
          realizadas: 0,
          habilitacao: 0,
          revisao: 0,
          hotLeadsHabilitacao: 0,
          hotLeadsRevisao: 0
        };
      }

      acc[id].leads += reg.leadsRecebidos || 0;
      acc[id].agendadas += reg.reunioesAgendadas || 0;
      acc[id].realizadas += reg.reunioesRealizadas || 0;
      acc[id].habilitacao += reg.contratosHabilitacao || 0;
      acc[id].revisao += reg.contratosRevisao || 0;
      acc[id].hotLeadsHabilitacao += reg.HotLeadsHabilitacao || 0;
      acc[id].hotLeadsRevisao += reg.HotLeadsRevisao || 0;

      return acc;
    }, {});

    return Object.values(agrupado);
  } catch (error) {
    console.error("Erro Marketing Action:", error);
    return [];
  }
}

export async function getPerformanceMarketing(mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  await exigirAcessoEquipe();

  try {
    const dataReferencia = new Date(anoValidado, mesValidado, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    const registros = await db.comercialPerformance.findMany({
      where: { dataRegistro: { gte: inicioMes, lte: fimMes } }
    });

    const agrupado = registros.reduce((acc: any, reg) => {
      const id = reg.colaboradoraId; 
      if (!acc[id]) {
        acc[id] = {
          id: id, 
          nome: id, 
          leads: 0, 
          leadsDesqualificados: 0,
          agendadas: 0,
          realizadas: 0,
          noShow: 0,
          habilitacao: 0, 
          revisao: 0,
          hotLeadsHabilitacao: 0, 
          hotLeadsRevisao: 0,
          TRAFEGO_PAGO: 0, CALLIX: 0, INDICACAO: 0, EVENTOS: 0, CHINA: 0,
          hab_TRAFEGO: 0, hab_CALLIX: 0, hab_INDICACAO: 0, hab_EVENTOS: 0, hab_CHINA: 0,
          rev_TRAFEGO: 0, rev_CALLIX: 0, rev_INDICACAO: 0, rev_EVENTOS: 0, rev_CHINA: 0
        };
      }

      acc[id].leads += contagem(reg.leadsRecebidos);
      acc[id].leadsDesqualificados += contagem(reg.leadsDesqualificados);
      
      acc[id].agendadas += contagem(reg.reunioesAgendadas);
      acc[id].realizadas += contagem(reg.reunioesRealizadas);
      acc[id].noShow += contagem(reg.noShow);
      
      acc[id].habilitacao += contagem(reg.contratosHabilitacao);
      acc[id].revisao += contagem(reg.contratosRevisao);
      acc[id].hotLeadsHabilitacao += contagem(reg.HotLeadsHabilitacao);
      acc[id].hotLeadsRevisao += contagem(reg.HotLeadsRevisao);

      const canal = reg.canal; 
      if (canal) {
        if (acc[id].hasOwnProperty(canal)) acc[id][canal] += contagem(reg.leadsRecebidos);

        if (canal === "TRAFEGO_PAGO") acc[id].hab_TRAFEGO += contagem(reg.contratosHabilitacao);
        if (canal === "CALLIX")       acc[id].hab_CALLIX += contagem(reg.contratosHabilitacao);
        if (canal === "INDICACAO")    acc[id].hab_INDICACAO += contagem(reg.contratosHabilitacao);
        if (canal === "EVENTOS")      acc[id].hab_EVENTOS += contagem(reg.contratosHabilitacao);
        if (canal === "CHINA")        acc[id].hab_CHINA += contagem(reg.contratosHabilitacao);

        if (canal === "TRAFEGO_PAGO") acc[id].rev_TRAFEGO += contagem(reg.contratosRevisao);
        if (canal === "CALLIX")       acc[id].rev_CALLIX += contagem(reg.contratosRevisao);
        if (canal === "INDICACAO")    acc[id].rev_INDICACAO += contagem(reg.contratosRevisao);
        if (canal === "EVENTOS")      acc[id].rev_EVENTOS += contagem(reg.contratosRevisao);
        if (canal === "CHINA")        acc[id].rev_CHINA += contagem(reg.contratosRevisao);
      }
      return acc;
    }, {});

    return Object.values(agrupado);
  } catch (error) {
    console.error("Erro Marketing:", error);
    return [];
  }
}

export async function getExportData(mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  await exigirAcessoEquipe();

  try {
    const dataReferencia = new Date(anoValidado, mesValidado, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    return await db.comercialPerformance.findMany({
      where: {
        dataRegistro: { gte: inicioMes, lte: fimMes }
      },
      orderBy: { dataRegistro: 'asc' }
    });
  } catch (error) {
    console.error("Erro ao exportar:", error);
    return [];
  }
}

export async function getExportDataColaborador(colaboradoraId: string, mes: number, ano: number) {
  const { mes: mesValidado, ano: anoValidado } = MesAnoSchema.parse({ mes, ano });
  const colaboradoraIdValidado = z.string().min(1).parse(colaboradoraId);
  await exigirAcessoColaborador(colaboradoraIdValidado);

  try {
    const dataReferencia = new Date(anoValidado, mesValidado, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    return await db.comercialPerformance.findMany({
      where: {
        colaboradoraId: colaboradoraIdValidado,
        dataRegistro: { gte: inicioMes, lte: fimMes }
      },
      orderBy: { dataRegistro: 'asc' }
    });
  } catch (error) {
    console.error("Erro ao exportar dados do usuário:", error);
    return [];
  }
}
