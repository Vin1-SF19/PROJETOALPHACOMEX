import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const raiz = process.cwd();
const ler = (arquivo: string) => readFileSync(resolve(raiz, arquivo), "utf8");

describe("CRM - persistência antes da movimentação", () => {
  it("serializa os saves e atualiza a versão-base confirmada pelo servidor", () => {
    const contexto = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx");
    const campos = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelCamposEtapaAtual.tsx");

    expect(contexto).toContain("savePromiseRef.current")
    expect(contexto).toContain("savesAnterioresConcluidos && saveAtualConcluido")
    expect(campos).toContain("versaoBaseCamposRef.current");
    expect(campos).toContain("const cardAtualizado = await ObterCardBpm(card.id)");
    expect(campos).toContain("versaoBaseCamposRef.current = novaVersao");
  });

  it("consome o resultado do flush para permitir uma nova tentativa", () => {
    const contexto = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardSaveContext.tsx");

    expect(contexto).toContain("const savesPendentes = savePromiseRef.current");
    expect(contexto).toContain("savePromiseRef.current === savesPendentes");
    expect(contexto).toContain("savePromiseRef.current = Promise.resolve(true)");
  });

  it("interrompe o movimento quando o flush informa falha", () => {
    const movimento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");
    const guarda = movimento.indexOf("if (!savesConcluidos)");
    const mover = movimento.indexOf("MoverCardBpm({ cardId: card.id, etapaDestinoId })");

    expect(movimento).toContain("const savesConcluidos = await flushSaves()");
    expect(guarda).toBeGreaterThan(-1);
    expect(guarda).toBeLessThan(mover);
  });

  it("força o blur do campo em edição antes de aguardar a fila de saves", () => {
    const movimento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");
    const blur = movimento.indexOf("document.activeElement.blur()");
    const flush = movimento.indexOf("const savesConcluidos = await flushSaves()");

    expect(blur).toBeGreaterThan(-1);
    expect(blur).toBeLessThan(flush);
  });

  it("bloqueia acionamentos repetidos enquanto salva e move o card", () => {
    const movimento = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximaEtapa.tsx");

    expect(movimento).toContain("const [movendoEtapa, setMovendoEtapa] = useState(false)");
    expect(movimento).toContain("if (etapaDestinoId === card.etapa.id || movendoEtapa) return");
    expect(movimento).toContain("disabled={movendoEtapa || !podeMoverEtapa");
    expect(movimento).toContain('aria-busy={movendoEtapa}');
    expect(movimento).toContain('className="shrink-0 animate-spin"');
  });

  it("PainelProximoContato registra save via CardSaveContext", () => {
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelProximoContato.tsx");
    expect(painel).toContain("useCardSave");
    expect(painel).toContain("registerSave");
    expect(painel).toContain("AtualizarCardBpm");
  });

  it("força blur e flush antes de fechar, mantendo o modal aberto em falha", () => {
    const modal = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardFullViewModal.tsx");
    const layout = ler("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
    const blur = modal.indexOf("document.activeElement.blur()");
    const flush = modal.indexOf("const savesConcluidos = await flushSaves()");
    const fechar = modal.indexOf("onClose();", flush);

    expect(modal).toContain("<CardSaveProvider>");
    expect(layout).not.toContain("<CardSaveProvider>");
    expect(blur).toBeGreaterThan(-1);
    expect(blur).toBeLessThan(flush);
    expect(modal).toContain("if (!savesConcluidos)");
    expect(fechar).toBeGreaterThan(flush);
  });

  it("PainelStatusPosFechamento registra save via CardSaveContext", () => {
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelStatusPosFechamento.tsx");
    expect(painel).toContain("useCardSave");
    expect(painel).toContain("registerSave");
    expect(painel).toContain("AtualizarCardBpm");
  });

  it("PainelChecklistFollowUp registra save via CardSaveContext", () => {
    const painel = ler("src/app/PainelAlpha/AlphaCRM/CardModal/PainelChecklistFollowUp.tsx");
    expect(painel).toContain("useCardSave");
    expect(painel).toContain("registerSave");
    expect(painel).toContain("SalvarChecklistFollowUpBpm");
  });
});
