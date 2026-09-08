import { fmtDateTime } from "@/lib/format-date";
import { rotuloEventoTimeline } from "@/lib/bpm/timeline";
import { STATUS_POS_FECHAMENTO_CONFIG } from "@/lib/bpm/status-pos-fechamento";
import { BPM_TAREFA_TIPO_CONFIG } from "@/lib/bpm/tarefas-tipo";

export interface ContextoDescricaoHistorico {
  etapas: readonly { id: string; nome: string }[];
  campos: readonly { id: string; nome: string }[];
  usuarios: readonly { id: number; nome: string }[];
}

export interface EntradaDescricaoHistorico {
  acao: string;
  valorAnteriorJson?: string | null;
  valorNovoJson?: string | null;
  contexto: ContextoDescricaoHistorico;
}

export const ACOES_HISTORICO_CATALOGADAS = [
  "ALERTA_AUTOMACAO",
  "ANEXO_ADICIONADO",
  "ANEXO_EXCLUIDO",
  "ANOTACAO_AUTOMACAO",
  "ANOTACAO_REGISTRADA",
  "AUTOMACAO_CENTRAL_EXECUTADA",
  "AUTOMACAO_DISPAROU_CARD",
  "AUTOMACAO_EXECUTADA",
  "AUTOMACAO_REPROCESSADA",
  "AUTOMACAO_TAREFA_NF",
  "CADENCIA_CANCELADA",
  "CADENCIA_CONCLUIDA",
  "CADENCIA_INICIADA",
  "CADENCIA_PAUSADA",
  "CADENCIA_PASSO_EXECUTADO",
  "CADENCIA_REATIVADA",
  "CARD_ATUALIZADO",
  "CARD_CRIADO",
  "CARD_CRIADO_POR_AUTOMACAO",
  "CARD_CRIADO_POR_OPORTUNIDADE",
  "CARD_MOVIDO",
  "CARD_MOVIDO_POR_AUTOMACAO",
  "CHECKLIST_ITEM_ATUALIZADO",
  "CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO",
  "CHECKLIST_MATERIALIZADO",
  "CHECKLIST_STATUS_ALTERADO",
  "COMUNICACAO_PENDENTE",
  "DISTRIBUICAO_AUTOMATICA",
  "FOLLOW_UP_ATUALIZADO",
  "FOLLOW_UP_CONCLUIDO",
  "FOLLOW_UP_CRIADO_E_CONCLUIDO",
  "FOLLOW_UP_INICIADO",
  "INTERACAO_REGISTRADA",
  "MEMBROS_ATUALIZADOS",
  "MONITORAMENTO_AUTOMATICO_EXECUTADO",
  "MOVIDO_AUTOMACAO",
  "NOVOS_LEADS_LIGACOES_PLANEJADAS",
  "OPORTUNIDADE_IDENTIFICADA",
  "PRESET_APLICADO",
  "RESUMO_REUNIAO_EDITADO",
  "REUNIAO_AGENDADA",
  "REUNIAO_REAGENDADA",
  "STANDBY_FOLLOW_UP_EXECUTADO",
  "STANDBY_FOLLOW_UP_INTERROMPIDO",
  "SUBSTATUS_ALTERADO",
  "TAREFA_ALERTA_DISPARADO",
  "TAREFA_CHECKLIST_ATUALIZADA",
  "TAREFA_CHECKLIST_CONCLUIDA",
  "TAREFA_CHECKLIST_CRIADA",
  "TAREFA_CHECKLIST_REABERTA",
  "TAREFA_CONCLUIDA",
  "TAREFA_CRIADA",
  "TRANSCRICAO_REUNIAO_ATUALIZADA",
  "TRANSCRICAO_REUNIAO_RECEBIDA",
  "VINCULO_CRIADO",
] as const;

type Registro = Record<string, unknown>;

interface SnapshotParseado {
  ok: boolean;
  valor: unknown;
}

function parsearSnapshot(valor: string | null | undefined): SnapshotParseado {
  if (!valor) return { ok: true, valor: null };
  try {
    return { ok: true, valor: JSON.parse(valor) as unknown };
  } catch {
    return { ok: false, valor: null };
  }
}

function ehRegistro(valor: unknown): valor is Registro {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function texto(registro: unknown, ...chaves: string[]): string | null {
  if (!ehRegistro(registro)) return null;
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === "string" && valor.trim()) return valor.trim();
  }
  return null;
}

function numero(registro: unknown, ...chaves: string[]): number | null {
  if (!ehRegistro(registro)) return null;
  for (const chave of chaves) {
    const valor = registro[chave];
    if (typeof valor === "number" && Number.isFinite(valor)) return valor;
    if (typeof valor === "string" && /^\d+$/.test(valor)) return Number(valor);
  }
  return null;
}

function booleano(registro: unknown, chave: string): boolean | null {
  if (!ehRegistro(registro) || typeof registro[chave] !== "boolean") return null;
  return registro[chave];
}

function lista(registro: unknown, chave: string): readonly unknown[] {
  if (!ehRegistro(registro)) return [];
  return Array.isArray(registro[chave]) ? registro[chave] : [];
}

function plural(quantidade: number, singular: string, pluralTexto: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

function pareceIdentificadorTecnico(valor: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(valor)
    || /^[a-z][a-z0-9_-]{19,}$/i.test(valor)
    || /^\d{6,}$/.test(valor);
}

function textoPublico(valor: string | null, fallback: string): string {
  return valor && !pareceIdentificadorTecnico(valor) ? valor : fallback;
}

function dataFormatada(registro: unknown, ...chaves: string[]): string | null {
  const valor = texto(registro, ...chaves);
  if (!valor) return null;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return null;
  return fmtDateTime(data);
}

function nomeEtapa(valor: unknown, contexto: ContextoDescricaoHistorico): string {
  const id = texto(valor, "etapaId", "etapaDestinoId", "novaEtapaId");
  if (id) return contexto.etapas.find((etapa) => etapa.id === id)?.nome ?? "etapa";
  if (typeof valor === "string" && valor.trim()) return textoPublico(valor.trim(), "etapa");
  return "etapa";
}

function nomeUsuario(id: number | null, contexto: ContextoDescricaoHistorico, fallback = "responsável"): string {
  if (id === null) return fallback;
  return contexto.usuarios.find((usuario) => usuario.id === id)?.nome ?? fallback;
}

function rotuloStatus(valor: string | null): string | null {
  if (!valor) return null;
  if (Object.hasOwn(STATUS_POS_FECHAMENTO_CONFIG, valor)) {
    return STATUS_POS_FECHAMENTO_CONFIG[valor as keyof typeof STATUS_POS_FECHAMENTO_CONFIG].label;
  }
  const checklist: Record<string, string> = {
    PENDENTE: "pendente",
    CONCLUIDO: "concluído",
    CONCLUIDA: "concluída",
    ATIVA: "ativa",
    PAUSADA: "pausada",
    CANCELADA: "cancelada",
  };
  return checklist[valor] ?? null;
}

function tipoTarefa(valor: string | null): string {
  if (valor && Object.hasOwn(BPM_TAREFA_TIPO_CONFIG, valor)) {
    return BPM_TAREFA_TIPO_CONFIG[valor as keyof typeof BPM_TAREFA_TIPO_CONFIG].label.toLocaleLowerCase("pt-BR");
  }
  return "tarefa";
}

function descricaoMovimento(
  automatico: boolean,
  anterior: unknown,
  novo: unknown,
  contexto: ContextoDescricaoHistorico,
): string {
  const origem = nomeEtapa(anterior, contexto);
  const destino = nomeEtapa(novo, contexto);
  const prefixo = automatico ? "Movido automaticamente" : "Movido";
  const status = rotuloStatus(texto(novo, "statusPosFechamento", "lifecycle"));
  return `${prefixo} de ${origem} para ${destino}${status ? ` (${status})` : ""}`;
}

function descricaoCardAtualizado(
  anterior: unknown,
  novo: unknown,
  contexto: ContextoDescricaoHistorico,
): string {
  const ids = lista(novo, "camposAlterados").filter((item): item is string => typeof item === "string");
  const chaves = ids.length > 0
    ? ids
    : ehRegistro(novo)
      ? Object.keys(novo).filter((chave) => !["versao", "updatedAt"].includes(chave))
      : [];
  const rotulos = chaves.map((chave) => {
    const campo = contexto.campos.find((item) => item.id === chave);
    if (campo) return campo.nome;
    const conhecidos: Record<string, string> = {
      titulo: "título",
      responsavelId: "responsável",
      proximoContatoEm: "próximo contato",
      statusPosFechamento: "status pós-fechamento",
      subStatusId: "substatus",
    };
    return conhecidos[chave] ?? "campo personalizado";
  });
  const unicos = [...new Set(rotulos)];
  if (unicos.length === 0 && anterior !== null) return "Dados do card atualizados";
  return unicos.length > 0 ? `Atualizado: ${unicos.join(", ")}` : "Dados do card atualizados";
}

function descricaoMembros(
  anterior: unknown,
  novo: unknown,
  contexto: ContextoDescricaoHistorico,
): string {
  const anteriores = new Set(lista(anterior, "membrosIds").map(Number).filter(Number.isFinite));
  const atuais = new Set(lista(novo, "membrosIds").map(Number).filter(Number.isFinite));
  const adicionados = [...atuais].filter((id) => !anteriores.has(id));
  const removidos = [...anteriores].filter((id) => !atuais.has(id));
  const detalhes: string[] = [];
  if (adicionados.length > 0) {
    detalhes.push(`+${adicionados.length} ${adicionados.length === 1 ? "adicionado" : "adicionados"}`);
  }
  if (removidos.length > 0) {
    detalhes.push(`-${removidos.length} ${removidos.length === 1 ? "removido" : "removidos"}`);
  }
  if (adicionados.length === 1) detalhes.push(nomeUsuario(adicionados[0], contexto, "membro"));
  return detalhes.length > 0 ? `Membros atualizados: ${detalhes.join(", ")}` : "Membros atualizados";
}

function descricaoReuniaoReagendada(anterior: unknown, novo: unknown): string {
  const dataAnterior = dataFormatada(anterior, "dataReuniao");
  const dataNova = dataFormatada(novo, "dataReuniao");
  if (!dataAnterior || !dataNova) return "Reunião reagendada";
  const preservada = booleano(novo, "transcricaoPreservada");
  return `Reunião reagendada de ${dataAnterior} para ${dataNova}${preservada ? "; transcrição preservada" : ""}`;
}

function descricaoTranscricao(acao: string, novo: unknown): string {
  const entradas = numero(novo, "entradas", "quantidadeEntradas");
  const caracteres = numero(novo, "caracteres", "quantidadeCaracteres");
  const verbo = acao === "TRANSCRICAO_REUNIAO_RECEBIDA" ? "recebida" : "atualizada";
  const detalhes = [
    entradas === null ? null : plural(entradas, "entrada", "entradas"),
    caracteres === null ? null : plural(caracteres, "caractere", "caracteres"),
  ].filter((item): item is string => item !== null);
  return `Transcrição da reunião ${verbo}${detalhes.length > 0 ? ` (${detalhes.join(", ")})` : ""}`;
}

function descreverCatalogado(
  acao: string,
  anterior: unknown,
  novo: unknown,
  contexto: ContextoDescricaoHistorico,
): string | null {
  const nome = (chave: string, fallback: string) => textoPublico(texto(novo, chave), fallback);
  const motivo = textoPublico(texto(novo, "motivo"), "");
  switch (acao) {
    case "ALERTA_AUTOMACAO": return `Alerta da automação${texto(novo, "texto") ? `: ${textoPublico(texto(novo, "texto"), "mensagem registrada")}` : " registrado"}`;
    case "ANEXO_ADICIONADO": return `Anexo adicionado: ${nome("nome", "arquivo")}`;
    case "ANEXO_EXCLUIDO": return `Anexo excluído: ${nome("nome", "arquivo")}`;
    case "ANOTACAO_AUTOMACAO": return `Anotação da automação${texto(novo, "texto") ? `: ${textoPublico(texto(novo, "texto"), "conteúdo registrado")}` : " registrada"}`;
    case "ANOTACAO_REGISTRADA": return "Anotação registrada";
    case "AUTOMACAO_CENTRAL_EXECUTADA": return "Automação central executada com sucesso";
    case "AUTOMACAO_DISPAROU_CARD": return `Automação criou um card no pipeline ${nome("pipelineDestino", "de destino")}`;
    case "AUTOMACAO_EXECUTADA": return `Automação ${nome("nome", "configurada")} executada`;
    case "AUTOMACAO_REPROCESSADA": {
      const tentativas = numero(novo, "tentativasAnteriores", "tentativas") ?? 0;
      return tentativas > 0 ? `Automação enviada para reprocessamento após ${plural(tentativas, "tentativa", "tentativas")}` : "Automação enviada para reprocessamento";
    }
    case "AUTOMACAO_TAREFA_NF": return "Tarefa de emissão de nota fiscal criada automaticamente";
    case "CADENCIA_CANCELADA": return `Cadência cancelada${motivo ? `: ${motivo}` : ""}`;
    case "CADENCIA_CONCLUIDA": return `Cadência ${nome("nomeCadencia", "configurada")} concluída`;
    case "CADENCIA_INICIADA": return `Cadência ${nome("nomeCadencia", "configurada")} iniciada`;
    case "CADENCIA_PAUSADA": return `Cadência pausada${motivo ? `: ${motivo}` : ""}`;
    case "CADENCIA_PASSO_EXECUTADO": return `Passo ${nome("passoTitulo", "configurado")} da cadência ${nome("nomeCadencia", "configurada")} executado`;
    case "CADENCIA_REATIVADA": return "Cadência reativada";
    case "CARD_ATUALIZADO": return descricaoCardAtualizado(anterior, novo, contexto);
    case "CARD_CRIADO": {
      const etapa = nomeEtapa(novo, contexto);
      const responsavelId = numero(novo, "responsavelId");
      const responsavel = responsavelId === null ? "" : `, responsável: ${nomeUsuario(responsavelId, contexto)}`;
      return `Card criado na ${etapa}${responsavel}`;
    }
    case "CARD_CRIADO_POR_AUTOMACAO": return `Card criado automaticamente${texto(novo, "pipelineOrigem") ? ` a partir do pipeline ${nome("pipelineOrigem", "de origem")}` : ""}`;
    case "CARD_CRIADO_POR_OPORTUNIDADE": return `Card criado para a oportunidade de ${nome("servico", "serviço")}`;
    case "CARD_MOVIDO": return descricaoMovimento(false, anterior, novo, contexto);
    case "CARD_MOVIDO_POR_AUTOMACAO":
    case "MOVIDO_AUTOMACAO": return descricaoMovimento(true, anterior, novo, contexto);
    case "CHECKLIST_ITEM_ATUALIZADO": {
      const status = rotuloStatus(texto(novo, "status"));
      return `Item de checklist atualizado${status ? `: ${status}` : ""}`;
    }
    case "CHECKLIST_ITEM_EXCLUSIVO_ADICIONADO": return `Item de checklist adicionado: ${nome("nome", "novo item")}`;
    case "CHECKLIST_MATERIALIZADO": return `Checklist ${nome("templateNome", "configurado")} aplicado ao card`;
    case "CHECKLIST_STATUS_ALTERADO": {
      const status = rotuloStatus(texto(novo, "status"));
      return status ? `Item de checklist marcado como ${status}` : "Status do checklist atualizado";
    }
    case "TAREFA_CHECKLIST_CRIADA": return "Tarefa criada automaticamente a partir do checklist";
    case "TAREFA_CHECKLIST_ATUALIZADA": return "Tarefa do checklist sincronizada";
    case "TAREFA_CHECKLIST_REABERTA": return "Tarefa reaberta porque o checklist voltou a ter pendências";
    case "TAREFA_CHECKLIST_CONCLUIDA": return "Tarefa concluída automaticamente com o checklist";
    case "COMUNICACAO_PENDENTE": return `Comunicação por ${nome("canal", "canal configurado")} aguardando envio`;
    case "DISTRIBUICAO_AUTOMATICA": return `Responsável definido automaticamente: ${nomeUsuario(numero(novo, "responsavelId"), contexto)}`;
    case "FOLLOW_UP_ATUALIZADO": return "Follow-up atualizado";
    case "FOLLOW_UP_CONCLUIDO": return "Follow-up concluído";
    case "FOLLOW_UP_CRIADO_E_CONCLUIDO": return "Follow-up registrado e concluído";
    case "FOLLOW_UP_INICIADO": return "Follow-up iniciado";
    case "INTERACAO_REGISTRADA": {
      const tipo = nome("tipo", "contato").toLocaleLowerCase("pt-BR");
      const data = dataFormatada(novo, "agendadoEm");
      return `Interação de ${tipo} registrada${data ? ` para ${data}` : ""}`;
    }
    case "MEMBROS_ATUALIZADOS": return descricaoMembros(anterior, novo, contexto);
    case "MONITORAMENTO_AUTOMATICO_EXECUTADO": {
      const proxima = dataFormatada(novo, "proximoElegivelEm", "proximaExecucaoEm");
      return `Monitoramento automático executado${proxima ? `; próxima revisão em ${proxima}` : ""}`;
    }
    case "NOVOS_LEADS_LIGACOES_PLANEJADAS": {
      const quantidade = numero(novo, "quantidade", "ligacoesPlanejadas") ?? 0;
      const dia = numero(novo, "diaCiclo", "dia") ?? 0;
      return `${plural(quantidade, "ligação planejada", "ligações planejadas")}${dia > 0 ? ` para o dia ${dia} do ciclo` : ""}`;
    }
    case "OPORTUNIDADE_IDENTIFICADA": return `Oportunidade de ${nome("servico", "serviço")} identificada`;
    case "PRESET_APLICADO": {
      const quantidade = numero(novo, "quantidade") ?? 0;
      return `Preset aplicado: ${plural(quantidade, "tarefa criada", "tarefas criadas")}`;
    }
    case "RESUMO_REUNIAO_EDITADO": {
      const antes = numero(anterior, "caracteres", "quantidadeCaracteres") ?? (typeof anterior === "string" ? anterior.length : null);
      const depois = numero(novo, "caracteres", "quantidadeCaracteres") ?? (typeof novo === "string" ? novo.length : null);
      return antes !== null && depois !== null ? `Resumo da reunião atualizado: de ${antes} para ${depois} caracteres` : "Resumo da reunião atualizado";
    }
    case "REUNIAO_AGENDADA": {
      const data = dataFormatada(novo, "dataReuniao");
      return data ? `Reunião agendada para ${data} (horário de Brasília)` : "Reunião agendada";
    }
    case "REUNIAO_REAGENDADA": return descricaoReuniaoReagendada(anterior, novo);
    case "STANDBY_FOLLOW_UP_EXECUTADO": {
      const proxima = dataFormatada(novo, "proximoElegivelEm", "proximaExecucaoEm");
      return `Follow-up semanal executado${proxima ? `; próxima execução em ${proxima}` : ""}`;
    }
    case "STANDBY_FOLLOW_UP_INTERROMPIDO": {
      const data = dataFormatada(novo, "interrompidoEm");
      return `Follow-up semanal interrompido${data ? ` em ${data}` : ""}${motivo ? `: ${motivo}` : ""}`;
    }
    case "SUBSTATUS_ALTERADO": return `Substatus alterado para ${nome("nome", "novo status")}`;
    case "TAREFA_ALERTA_DISPARADO": return "Alerta de tarefa disparado";
    case "TAREFA_CONCLUIDA": return `Tarefa concluída${texto(novo, "titulo") ? `: ${nome("titulo", "tarefa")}` : ""}`;
    case "TAREFA_CRIADA": {
      const tipo = tipoTarefa(texto(novo, "tipo"));
      const prazo = dataFormatada(novo, "prazo");
      return `${tipo.charAt(0).toLocaleUpperCase("pt-BR") + tipo.slice(1)} criada${prazo ? ` para ${prazo}` : ""}`;
    }
    case "TRANSCRICAO_REUNIAO_ATUALIZADA":
    case "TRANSCRICAO_REUNIAO_RECEBIDA": return descricaoTranscricao(acao, novo);
    case "VINCULO_CRIADO": return "Vínculo criado com outro card";
    default: return null;
  }
}

export function descreverEventoHistorico({
  acao,
  valorAnteriorJson,
  valorNovoJson,
  contexto,
}: EntradaDescricaoHistorico): string {
  const fallback = rotuloEventoTimeline(acao);
  const anterior = parsearSnapshot(valorAnteriorJson);
  const novo = parsearSnapshot(valorNovoJson);
  if (!anterior.ok || !novo.ok) return fallback;

  try {
    return descreverCatalogado(acao, anterior.valor, novo.valor, contexto)?.trim() || fallback;
  } catch {
    return fallback;
  }
}
