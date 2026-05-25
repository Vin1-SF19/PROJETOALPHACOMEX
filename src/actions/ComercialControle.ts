"use server"

import db from "@/lib/prisma";
import { startOfMonth, startOfWeek, startOfDay, endOfDay, endOfMonth } from "date-fns";
import { revalidatePath } from "next/cache";
import { auth } from "../../auth";

export async function getPerformanceColaborador(colaboradoraId: string, data: Date) {
  try {
    const registros = await db.comercialPerformance.findMany({
      where: {
        colaboradoraId,
        dataRegistro: {
          gte: startOfDay(new Date(data)),
          lte: endOfDay(new Date(data)),
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
    const colaboradoraId = u?.nome || u?.usuario || "Sistema";

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
        leadsRecebidos: Number(dados.leadsRecebidos) || 0,
        leadsDesqualificados: Number(dados.leadsDesqualificados) || 0,
        reunioesAgendadas: Number(dados.reunioesAgendadas) || 0,
        reunioesRealizadas: Number(dados.reunioesRealizadas) || 0,
        noShow: Number(dados.noShow) || 0,
        contratosHabilitacao: Number(dados.contratosHabilitacao) || 0,
        contratosRevisao: Number(dados.contratosRevisao) || 0,
        HotLeadsHabilitacao: Number(dados.HotLeadsHabilitacao) || 0,
        HotLeadsRevisao: Number(dados.HotLeadsRevisao) || 0,
      },
      create: {
        dataRegistro: dataNormalizada,
        colaboradoraId: colaboradoraId,
        canal: dados.canal,
        servico: dados.servico,
        leadsRecebidos: Number(dados.leadsRecebidos) || 0,
        leadsDesqualificados: Number(dados.leadsDesqualificados) || 0,
        reunioesAgendadas: Number(dados.reunioesAgendadas) || 0,
        reunioesRealizadas: Number(dados.reunioesRealizadas) || 0,
        noShow: Number(dados.noShow) || 0,
        contratosHabilitacao: Number(dados.contratosHabilitacao) || 0,
        contratosRevisao: Number(dados.contratosRevisao) || 0,
        HotLeadsHabilitacao: Number(dados.HotLeadsHabilitacao) || 0,
        HotLeadsRevisao: Number(dados.HotLeadsRevisao) || 0,
      },
    });

    revalidatePath("/PainelAlpha/ControleLeads/Lancamentos");
    return { success: true, data: registro };
  } catch (error) {
    console.error("Erro ao salvar performance:", error);
    return { success: false, error: "Falha ao sincronizar com o banco." };
  }
}

export async function getPerformanceDiaria(colaboradoraId: string, data: Date, canal: string) {
  try {
    const registros = await db.comercialPerformance.findMany({
      where: {
        colaboradoraId,
        canal,
        dataRegistro: {
          gte: startOfDay(new Date(data)),
          lte: endOfDay(new Date(data)),
        },
      },
    });

    return registros.reduce((acc, reg) => ({
      leads_recebidos: acc.leads_recebidos + (reg.leadsRecebidos || 0),
      leads_desqualificados: acc.leads_desqualificados + (reg.leadsDesqualificados || 0),
      reunioes_agendadas: acc.reunioes_agendadas + (reg.reunioesAgendadas || 0),
      reunioes_realizadas: acc.reunioes_realizadas + (reg.reunioesRealizadas || 0),
      no_show: acc.no_show + (reg.noShow || 0),
      contratos_Habilit: acc.contratos_Habilit + (reg.contratosHabilitacao || 0),
      contratos_Revisao: acc.contratos_Revisao + (reg.contratosRevisao || 0),
      
      HotLeadsHabilitacao: acc.HotLeadsHabilitacao + (reg.HotLeadsHabilitacao || 0),
      HotLeadsRevisao: acc.HotLeadsRevisao + (reg.HotLeadsRevisao || 0)
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

export async function getPerformanceAcumulada(colaboradoraId: string, mes: number, ano: number) {
  try {
    const dataReferencia = new Date(ano, mes, 1);
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
      leads: acc.leads + (reg.leadsRecebidos || 0),
      leadsDesqualificados: acc.leadsDesqualificados + (reg.leadsDesqualificados || 0),
      agendadas: acc.agendadas + (reg.reunioesAgendadas || 0),
      realizadas: acc.realizadas + (reg.reunioesRealizadas || 0),
      noShow: acc.noShow + (reg.noShow || 0),
      habilitacao: acc.habilitacao + (reg.contratosHabilitacao || 0),
      revisao: acc.revisao + (reg.contratosRevisao || 0),
      HotLeadsHabilitacao: acc.HotLeadsHabilitacao + (reg.HotLeadsHabilitacao || 0),
      HotLeadsRevisao: acc.HotLeadsRevisao + (reg.HotLeadsRevisao || 0)
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

export async function getPerformanceEquipeCompleta(mes: number, ano: number) {
  try {
    const dataReferencia = new Date(ano, mes, 1);
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
  try {
    const dataReferencia = new Date(ano, mes, 1);
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

      acc[id].leads += reg.leadsRecebidos || 0;
      
      acc[id].agendadas += reg.reunioesAgendadas || 0;
      acc[id].realizadas += reg.reunioesRealizadas || 0;
      acc[id].noShow += reg.noShow || 0;
      
      acc[id].habilitacao += reg.contratosHabilitacao || 0;
      acc[id].revisao += reg.contratosRevisao || 0;
      acc[id].hotLeadsHabilitacao += reg.HotLeadsHabilitacao || 0;
      acc[id].hotLeadsRevisao += reg.HotLeadsRevisao || 0;

      const canal = reg.canal; 
      if (canal) {
        if (acc[id].hasOwnProperty(canal)) acc[id][canal] += reg.leadsRecebidos || 0;

        if (canal === "TRAFEGO_PAGO") acc[id].hab_TRAFEGO += reg.contratosHabilitacao || 0;
        if (canal === "CALLIX")       acc[id].hab_CALLIX += reg.contratosHabilitacao || 0;
        if (canal === "INDICACAO")    acc[id].hab_INDICACAO += reg.contratosHabilitacao || 0;
        if (canal === "EVENTOS")      acc[id].hab_EVENTOS += reg.contratosHabilitacao || 0;
        if (canal === "CHINA")        acc[id].hab_CHINA += reg.contratosHabilitacao || 0;

        if (canal === "TRAFEGO_PAGO") acc[id].rev_TRAFEGO += reg.contratosRevisao || 0;
        if (canal === "CALLIX")       acc[id].rev_CALLIX += reg.contratosRevisao || 0;
        if (canal === "INDICACAO")    acc[id].rev_INDICACAO += reg.contratosRevisao || 0;
        if (canal === "EVENTOS")      acc[id].rev_EVENTOS += reg.contratosRevisao || 0;
        if (canal === "CHINA")        acc[id].rev_CHINA += reg.contratosRevisao || 0;
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
  try {
    const dataReferencia = new Date(ano, mes, 1);
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
  try {
    const dataReferencia = new Date(ano, mes, 1);
    const inicioMes = startOfMonth(dataReferencia);
    const fimMes = endOfMonth(dataReferencia);

    return await db.comercialPerformance.findMany({
      where: {
        colaboradoraId: colaboradoraId,
        dataRegistro: { gte: inicioMes, lte: fimMes }
      },
      orderBy: { dataRegistro: 'asc' }
    });
  } catch (error) {
    console.error("Erro ao exportar dados do usuário:", error);
    return [];
  }
}