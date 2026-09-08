import { describe, expect, it } from "vitest";
import {
  ACOES_HISTORICO_CATALOGADAS,
  descreverEventoHistorico,
  type ContextoDescricaoHistorico,
} from "@/lib/bpm/historico-descricao";

const contexto: ContextoDescricaoHistorico = {
  etapas: [
    { id: "etapa-origem-id", nome: "Prospecção" },
    { id: "etapa-destino-id", nome: "Reunião Agendada" },
  ],
  campos: [{ id: "campo-personalizado-id", nome: "Valor do contrato" }],
  usuarios: [
    { id: 17, nome: "Ana Lima" },
    { id: 29, nome: "Bruno Souza" },
  ],
};

const idGoogle = "qeoacq2tbotm8am596hcapgq2s";
const idTecnico = "cmf1234567890abcdefghijkl";

function descrever(
  acao: string,
  anterior?: unknown,
  novo?: unknown,
): string {
  return descreverEventoHistorico({
    acao,
    valorAnteriorJson: anterior === undefined ? null : JSON.stringify(anterior),
    valorNovoJson: novo === undefined ? null : JSON.stringify(novo),
    contexto,
  });
}

describe("descreverEventoHistorico", () => {
  it("formata reunião em São Paulo e omite o ID técnico do Google", () => {
    const descricao = descrever("REUNIAO_AGENDADA", undefined, {
      dataReuniao: "2026-09-05T12:00:00.000Z",
      googleEventId: idGoogle,
      googleCalendarId: idTecnico,
    });

    expect(descricao).toBe("Reunião agendada para 05/09/2026, 09:00 (horário de Brasília)");
    expect(descricao).not.toContain(idGoogle);
    expect(descricao).not.toContain(idTecnico);
    expect(descricao).not.toContain("dataReuniao");
  });

  it("descreve movimento resolvendo as etapas já carregadas", () => {
    expect(descrever(
      "CARD_MOVIDO",
      { etapaId: "etapa-origem-id" },
      { etapaId: "etapa-destino-id", statusPosFechamento: "CONTRATO_ENVIADO" },
    )).toBe("Movido de Prospecção para Reunião Agendada (Contrato enviado)");
  });

  it("traduz checklist e automação sem expor identificadores", () => {
    expect(descrever("CHECKLIST_STATUS_ALTERADO", { status: "PENDENTE" }, {
      status: "CONCLUIDO",
      checklistId: idTecnico,
      itemId: idTecnico,
    })).toBe("Item de checklist marcado como concluído");

    const automacao = descrever("AUTOMACAO_EXECUTADA", undefined, {
      nome: "Distribuir oportunidades",
      automacaoId: idTecnico,
      execucaoId: idTecnico,
    });
    expect(automacao).toBe("Automação Distribuir oportunidades executada");
    expect(automacao).not.toContain(idTecnico);
  });

  it("resolve campos e usuários pelo contexto sem consulta adicional", () => {
    expect(descrever("CARD_ATUALIZADO", {}, {
      camposAlterados: ["campo-personalizado-id", idTecnico],
    })).toBe("Atualizado: Valor do contrato, campo personalizado");
    expect(descrever("DISTRIBUICAO_AUTOMATICA", undefined, { responsavelId: 17 }))
      .toBe("Responsável definido automaticamente: Ana Lima");
    expect(descrever("DISTRIBUICAO_AUTOMATICA", undefined, { responsavelId: 999999 }))
      .toBe("Responsável definido automaticamente: responsável");
  });

  it.each(ACOES_HISTORICO_CATALOGADAS)("mantém %s legível e sem payload cru", (acao) => {
    const descricao = descrever(acao, {
      etapaId: "etapa-origem-id",
      status: "PENDENTE",
      membrosIds: [17],
      dataReuniao: "2026-09-05T11:00:00.000Z",
      caracteres: 10,
    }, {
      etapaId: "etapa-destino-id",
      status: "CONCLUIDO",
      membrosIds: [17, 29],
      dataReuniao: "2026-09-05T12:00:00.000Z",
      prazo: "2026-09-06T12:00:00.000Z",
      proximoElegivelEm: "2026-09-12T12:00:00.000Z",
      interrompidoEm: "2026-09-05T12:00:00.000Z",
      nome: "Evento amigável",
      nomeCadencia: "Cadência comercial",
      passoTitulo: "Telefonar",
      templateNome: "Documentação",
      servico: "Radar Siscomex",
      canal: "WhatsApp",
      tipo: "LIGACAO",
      titulo: "Retornar ao cliente",
      texto: "Cliente precisa de retorno",
      motivo: "Solicitação do cliente",
      quantidade: 2,
      diaCiclo: 3,
      entradas: 4,
      caracteres: 120,
      tentativasAnteriores: 2,
      responsavelId: 17,
      googleEventId: idGoogle,
      googleCalendarId: idTecnico,
      tarefaId: idTecnico,
      checklistId: idTecnico,
      templateId: idTecnico,
      itemId: idTecnico,
      cadenciaId: idTecnico,
      cardDestinoId: idTecnico,
      cardOrigemId: idTecnico,
      presetId: idTecnico,
    });

    expect(descricao.trim().length).toBeGreaterThan(0);
    expect(descricao).not.toMatch(/^\s*[\[{]/);
    expect(descricao).not.toContain("[object Object]");
    expect(descricao).not.toContain("undefined");
    expect(descricao).not.toContain("null");
    expect(descricao).not.toContain(idGoogle);
    expect(descricao).not.toContain(idTecnico);
  });

  it("usa o rótulo do evento para ação desconhecida, JSON inválido e data inválida", () => {
    expect(descrever("ACAO_NUNCA_MAPEADA", undefined, { segredo: idTecnico }))
      .toBe("Acao nunca mapeada");

    expect(descreverEventoHistorico({
      acao: "REUNIAO_AGENDADA",
      valorNovoJson: "{json-invalido",
      contexto,
    })).toBe("Reunião agendada");

    expect(descrever("REUNIAO_AGENDADA", undefined, { dataReuniao: "data-inválida" }))
      .toBe("Reunião agendada");
  });
});
