import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  criarSnapshotBoard,
  moverCardOtimistaNoBoard,
  podeIniciarArrastoBoard,
  resolverMovimentoOtimistaBoard,
  restaurarSnapshotBoard,
} from "@/lib/bpm/drag-drop-board";

const raiz = process.cwd();
const board = readFileSync(
  resolve(raiz, "src/app/PainelAlpha/AlphaCRM/pipeline/[pipelineId]/PipelineBoardClient.tsx"),
  "utf8",
);

const cards = [
  { id: "a", etapaId: "novos", titulo: "Primeiro" },
  { id: "b", etapaId: "tratativa", titulo: "Segundo" },
  { id: "c", etapaId: "novos", titulo: "Terceiro" },
];

describe("CRM - rollback do drag-and-drop", () => {
  it("restaura a lista inteira, a etapa e a ordem exatas depois de uma recusa", () => {
    const snapshot = criarSnapshotBoard(cards);
    const otimista = moverCardOtimistaNoBoard(cards, "a", "tratativa");
    const restaurado = restaurarSnapshotBoard(snapshot);

    expect(otimista.find((card) => card.id === "a")?.etapaId).toBe("tratativa");
    expect(restaurado).toEqual(cards);
    expect(restaurado.map((card) => card.id)).toEqual(["a", "b", "c"]);
    expect(restaurado).not.toBe(snapshot);
    expect(restaurado[0]).not.toBe(snapshot[0]);
  });

  it("mantem o snapshot isolado de mudancas otimistas posteriores", () => {
    const snapshot = criarSnapshotBoard(cards);
    const primeiraMudanca = moverCardOtimistaNoBoard(cards, "a", "tratativa");
    const segundaMudanca = moverCardOtimistaNoBoard(primeiraMudanca, "c", "tratativa");

    expect(segundaMudanca.filter((card) => card.etapaId === "tratativa")).toHaveLength(3);
    expect(restaurarSnapshotBoard(snapshot)).toEqual(cards);
  });

  it("nao faz rollback depois que o backend confirmou, mesmo se a reconciliacao falhar", async () => {
    let restauracoes = 0;
    const resultado = await resolverMovimentoOtimistaBoard({
      mover: async () => true,
      reconciliar: async () => {
        throw new Error("falha transitória de listagem");
      },
      restaurar: async () => {
        restauracoes += 1;
      },
    });

    expect(resultado).toBe("SINCRONIZACAO_PENDENTE");
    expect(restauracoes).toBe(0);
  });

  it("mantem o snapshot restaurado quando o movimento falha e a listagem posterior tambem falha", async () => {
    const snapshot = criarSnapshotBoard(cards);
    let estadoBoard = moverCardOtimistaNoBoard(cards, "a", "tratativa");
    const resultado = await resolverMovimentoOtimistaBoard({
      mover: async () => false,
      reconciliar: async () => {
        throw new Error("nao deve reconciliar movimento recusado");
      },
      restaurar: async () => {
        estadoBoard = restaurarSnapshotBoard(snapshot);
        try {
          throw new Error("falha ao sincronizar rollback");
        } catch {
          // O cliente preserva o rollback local e apenas evita apagar a mensagem.
        }
      },
    });

    expect(resultado).toBe("RESTAURADO");
    expect(estadoBoard).toEqual(cards);
  });

  it("bloqueia um segundo drag enquanto a movimentacao anterior ainda esta pendente", () => {
    expect(podeIniciarArrastoBoard(false)).toBe(true);
    expect(podeIniciarArrastoBoard(true)).toBe(false);
    expect(board).toContain("disabled: arrastoDesabilitado");
    expect(board).toContain("arrastoDesabilitado={movimentoPendente}");
    expect(board).toContain("const movimentoPendenteRef = useRef(false);");
    expect(board).toContain("podeIniciarArrastoBoard(movimentoPendenteRef.current)");
  });

  it("liga cancelamento e drop sem destino \u00e0 restaura\u00e7\u00e3o antes da reconcilia\u00e7\u00e3o", () => {
    expect(board).toContain("onDragCancel={onDragCancel}");
    expect(board).toContain("function onDragCancel()");
    expect(board).toMatch(/if \(!over\) \{\s*await restaurarArrasto\(snapshot\);/);
    expect(board).toContain("await restaurarArrasto(snapshot);");
  });

  it("restaura antes de sincronizar e preserva a razao devolvida pelo backend", () => {
    expect(board).toContain("setCards(restaurarSnapshotBoard(snapshot.cards));");
    expect(board).toContain("setErro(mensagem);");
    expect(board).toContain("preservarErro: Boolean(mensagem)");
    expect(board).toContain('role="alert"');
    expect(board).toContain('aria-live="assertive"');
  });

  it("protege rollback de respostas antigas, reconcilia sucesso e nao atualiza a rota no caminho DnD", () => {
    expect(board).toContain("const generation = ++generationBoardRef.current;");
    expect(board).toContain("generation !== generationBoardRef.current");
    expect(board).toContain("resolverMovimentoOtimistaBoard({");
    expect(board).toContain("reconciliar: () => recarregarCards({ generation: snapshot.generation })");
    expect(board).toContain('setErro("Movimento salvo, mas nao foi possivel sincronizar o board agora.");');

    const inicioDnD = board.indexOf("function onDragStart");
    const fimDnD = board.indexOf("const activeCard = cards.find", inicioDnD);
    expect(board.slice(inicioDnD, fimDnD)).not.toContain("router.refresh()");
  });

  it("mantem colunas vazias como destinos de drop", () => {
    expect(board).toContain("useDroppable({ id: etapa.id })");
    expect(board).toContain("ref={setDroppableRef}");
  });
});
