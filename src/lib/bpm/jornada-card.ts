export type EventoEtapaCard = {
  id: string;
  acao: string;
  valorAnteriorJson: string | null;
  valorNovoJson: string | null;
  createdAt: Date;
};

export type CardParaJornada = {
  id: string;
  etapaId: string;
  createdAt: Date;
  updatedAt: Date;
  historico: EventoEtapaCard[];
};

export type PassagemEtapaCard = {
  cardId: string;
  etapaId: string;
  entrouEm: string | null;
  origem: "HISTORICO" | "ESTADO_ATUAL";
};

export const ACOES_JORNADA_ETAPA = [
  "CARD_CRIADO", "CARD_CRIADO_POR_AUTOMACAO", "CARD_CRIADO_POR_OPORTUNIDADE",
  "CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", "MOVIDO_AUTOMACAO",
] as const;

const ACOES_MOVIMENTO = new Set<string>(["CARD_MOVIDO", "CARD_MOVIDO_POR_AUTOMACAO", "MOVIDO_AUTOMACAO"]);

function etapaNoJson(json: string | null): string | null {
  if (!json) return null;
  try {
    const valor: unknown = JSON.parse(json);
    if (typeof valor !== "object" || valor === null || !("etapaId" in valor)) return null;
    return typeof valor.etapaId === "string" && valor.etapaId ? valor.etapaId : null;
  } catch {
    return null;
  }
}

/** Projeta visitas reais, incluindo retornos, sem inferir passagens pela ordem das colunas. */
export function projetarPassagensCard(card: CardParaJornada): PassagemEtapaCard[] {
  const eventos = [...card.historico]
    .filter((evento) => ACOES_JORNADA_ETAPA.some((acao) => acao === evento.acao))
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const passagens: PassagemEtapaCard[] = [];
  const registrar = (etapaId: string, data: Date | null, origem: PassagemEtapaCard["origem"]) => {
    passagens.push({ cardId: card.id, etapaId, entrouEm: data?.toISOString() ?? null, origem });
  };

  for (const evento of eventos) {
    if (ACOES_MOVIMENTO.has(evento.acao) && passagens.length === 0) {
      const origem = etapaNoJson(evento.valorAnteriorJson);
      if (origem) registrar(origem, card.createdAt, "HISTORICO");
    }
    const destino = etapaNoJson(evento.valorNovoJson);
    if (destino) registrar(destino, evento.createdAt, "HISTORICO");
  }

  if (passagens.length === 0 || passagens.at(-1)?.etapaId !== card.etapaId) {
    registrar(card.etapaId, passagens.length ? null : card.createdAt, "ESTADO_ATUAL");
  }
  return passagens;
}
