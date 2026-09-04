import { describe, expect, it } from "vitest";
import { montarFeedTimelineCard, rotuloEventoTimeline } from "@/lib/bpm/timeline";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function ler(relPath: string): string {
  return readFileSync(join(process.cwd(), relPath), "utf-8");
}

describe("montarFeedTimelineCard — agregação de múltiplas fontes", () => {
  const historico = [
    {
      id: "h1",
      acao: "CARD_CRIADO",
      createdAt: "2026-09-01T10:00:00Z",
      usuario: { nome: "Ana" },
      automacaoOrigem: null,
    },
    {
      id: "h2",
      acao: "CARD_MOVIDO",
      createdAt: "2026-09-03T10:00:00Z",
      usuario: { nome: "Ana" },
      automacaoOrigem: null,
      valorAnteriorJson: JSON.stringify("Prospecção"),
      valorNovoJson: JSON.stringify("Reunião Agendada"),
    },
    {
      id: "h3",
      acao: "CARD_MOVIDO_POR_AUTOMACAO",
      createdAt: "2026-09-02T10:00:00Z",
      usuario: null,
      automacaoOrigem: "regra-1",
    },
    // Deve ser filtrado: já entra via `anotacoes` com o texto completo.
    {
      id: "h4",
      acao: "ANOTACAO_REGISTRADA",
      createdAt: "2026-09-02T11:00:00Z",
      usuario: { nome: "Ana" },
      automacaoOrigem: null,
    },
  ];

  const anotacoes = [
    {
      id: "a1",
      createdAt: "2026-09-04T10:00:00Z",
      observacoes: "Cliente confirmou reunião",
      registradoPor: { nome: "Bruno" },
    },
  ];

  it("agrega eventos de histórico e anotações num único feed", () => {
    const feed = montarFeedTimelineCard(historico, anotacoes);
    expect(feed).toHaveLength(4);
    expect(feed.find((i) => i.id === "h4")).toBeUndefined();
  });

  it("ordena o feed cronologicamente decrescente", () => {
    const feed = montarFeedTimelineCard(historico, anotacoes);
    const datas = feed.map((i) => i.data.getTime());
    expect(datas).toEqual([...datas].sort((a, b) => b - a));
    expect(feed[0].id).toBe("a1");
    expect(feed[feed.length - 1].id).toBe("h1");
  });

  it("preenche autor, origem, valor anterior e valor novo quando existirem", () => {
    const feed = montarFeedTimelineCard(historico, anotacoes);
    const movido = feed.find((i) => i.id === "h2")!;
    expect(movido.autor).toBe("Ana");
    expect(movido.origem).toBe("usuario");
    expect(movido.valorAnterior).toBe(JSON.stringify("Prospecção"));
    expect(movido.valorNovo).toBe(JSON.stringify("Reunião Agendada"));

    const automatico = feed.find((i) => i.id === "h3")!;
    expect(automatico.origem).toBe("automacao");
    expect(automatico.autor).toContain("regra-1");

    const anotacao = feed.find((i) => i.id === "a1")!;
    expect(anotacao.tipo).toBe("anotacao");
    expect(anotacao.autor).toBe("Bruno");
    expect(anotacao.texto).toBe("Cliente confirmou reunião");
  });

  it("retorna feed vazio quando não há histórico nem anotações", () => {
    expect(montarFeedTimelineCard([], [])).toEqual([]);
  });

  it("traduz ações conhecidas para rótulo legível e usa fallback para desconhecidas", () => {
    expect(rotuloEventoTimeline("CARD_MOVIDO")).toBe("Card movido de etapa");
    expect(rotuloEventoTimeline("ACAO_NUNCA_MAPEADA")).toBe("Acao nunca mapeada");
  });
});

describe("PainelHistorico — ownership e estado vazio da timeline do card", () => {
  const painelHistorico = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelHistorico.tsx");
  const cardsAction = ler("src/actions/bpm/Cards.ts");
  const interacoesAction = ler("src/actions/bpm/Interacoes.ts");

  it("exibe estado vazio quando não há eventos no feed", () => {
    expect(painelHistorico).toContain("Sem histórico.");
    expect(painelHistorico).toContain("feedHistorico.length === 0");
  });

  it("a leitura do card (fonte do histórico) exige exigirAcessoBpmCard antes de retornar dados", () => {
    expect(cardsAction).toContain("exigirAcessoBpmCard");
  });

  it("a leitura de interações (anotações da timeline) exige checagem de acesso ao card", () => {
    expect(interacoesAction).toContain("exigirAcessoBpmCard");
  });
});
