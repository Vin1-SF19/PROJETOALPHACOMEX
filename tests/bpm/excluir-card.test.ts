import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relative: string) => readFileSync(resolve(relative), "utf8");

describe("ExcluirCardBpm — Server Action", () => {
  it("usa exigirAcessoBpmCard com a ação excluirCard", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain('exigirAcessoBpmCard(cardId, userId, userRole, "excluirCard")');
  });

  it("valida cardId antes de qualquer operação", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain("Card inválido");
  });

  it("usa db.$transaction para o delete atômico", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain("tx.bpmCard.delete");
  });

  it("retorna mensagem amigável em caso de erro", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain('"Erro ao excluir card"');
  });

  it("retorna 'Não autorizado' quando a permissão é negada", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain('"Não autorizado"');
  });

  it("notifica em tempo real com tipo CARD_EXCLUIDO", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain('tipo: "CARD_EXCLUIDO"');
  });

  it("revalida o caminho do pipeline após exclusão", () => {
    const cards = source("src/actions/bpm/Cards.ts");
    expect(cards).toContain("revalidatePath(`${ROTA_BASE}/pipeline/${cardAntes.pipelineId}`)");
  });
});

describe("ExcluirCardBpm — UI de disparo", () => {
  it("CardAbertoLayout tem botão de excluir com AlertDialog", () => {
    const layout = source("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
    expect(layout).toContain("ExcluirCardBpm");
    expect(layout).toContain("AlertDialog");
    expect(layout).toContain("Excluir card");
    expect(layout).toContain("irreversível");
  });

  it("botão de excluir só aparece para quem podeGerenciarMembros", () => {
    const layout = source("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
    expect(layout).toContain("podeGerenciarMembros &&");
  });

  it("usa toast para feedback de sucesso e erro", () => {
    const layout = source("src/app/PainelAlpha/AlphaCRM/CardModal/CardAbertoLayout.tsx");
    expect(layout).toContain("toast.success");
    expect(layout).toContain("toast.error");
  });
});

describe("ExcluirCardBpm — permissão no ownership", () => {
  it("excluirCard está mapeado para RESPONSAVEL e ADMINISTRADOR", () => {
    const ownership = source("src/lib/bpm/ownership.ts");
    expect(ownership).toContain('"excluirCard"');
    // RESPONSAVEL e ADMINISTRADOR têm excluirCard
    const responsavelBlock = ownership.match(/RESPONSAVEL:\s*\[[\s\S]*?\]/);
    const adminBlock = ownership.match(/ADMINISTRADOR:\s*\[[\s\S]*?\]/);
    expect(responsavelBlock?.[0]).toContain("excluirCard");
    expect(adminBlock?.[0]).toContain("excluirCard");
  });

  it("PARTICIPANTE não tem excluirCard", () => {
    const ownership = source("src/lib/bpm/ownership.ts");
    const participanteBlock = ownership.match(/PARTICIPANTE:\s*ACOES_TRABALHO_CARD/);
    expect(participanteBlock).not.toBeNull();
    // ACOES_TRABALHO_CARD não inclui excluirCard
    const acoesTrabalho = ownership.match(/ACOES_TRABALHO_CARD: BpmAcao\[\] = \[[\s\S]*?\]/);
    expect(acoesTrabalho?.[0]).not.toContain("excluirCard");
  });
});

describe("ExcluirCardBpm — realtime tipo", () => {
  it("CARD_EXCLUIDO está no BPM_REALTIME_TIPOS", () => {
    const realtime = source("src/lib/bpm/realtime.ts");
    expect(realtime).toContain('"CARD_EXCLUIDO"');
  });
});
