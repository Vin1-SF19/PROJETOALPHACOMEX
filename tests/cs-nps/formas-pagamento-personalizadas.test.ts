import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS,
  FORMAS_LABEL,
  FORMAS_PAGAMENTO,
  listarFormasPagamentoPersonalizadas,
  removerFormaPagamentoPersonalizada,
  salvarFormaPagamentoPersonalizada,
} from "@/app/PainelAlpha/CadastroClientes/ModalCadastro/formas-pagamento";

function criarArmazenamento(conteudoInicial: string | null = null) {
  const itens = new Map<string, string>();
  if (conteudoInicial) itens.set(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS, conteudoInicial);
  return {
    getItem: (chave: string) => itens.get(chave) ?? null,
    setItem: (chave: string, valor: string) => { itens.set(chave, valor); },
    conteudo: () => itens.get(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS) ?? null,
  };
}

describe("formas de pagamento personalizadas do CS & NPS", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mantém exatamente as três formas padrão", () => {
    expect(FORMAS_PAGAMENTO).toHaveLength(3);
    expect(FORMAS_PAGAMENTO.map((forma) => FORMAS_LABEL[forma])).toHaveLength(3);
  });

  it("salva a forma personalizada para usos futuros", () => {
    const armazenamento = criarArmazenamento();
    const resultado = salvarFormaPagamentoPersonalizada("  Boleto em 3x  ", [], armazenamento);

    expect(resultado).toEqual({ formas: ["Boleto em 3x"], valorCanonico: "Boleto em 3x" });
    expect(armazenamento.conteudo()).toBe(JSON.stringify(["Boleto em 3x"]));
  });

  it("reutiliza a grafia canônica existente ao salvar uma duplicata", () => {
    const armazenamento = criarArmazenamento();
    const resultado = salvarFormaPagamentoPersonalizada(
      "boleto EM 3X",
      ["Boleto em 3x"],
      armazenamento,
    );

    expect(resultado).toEqual({ formas: ["Boleto em 3x"], valorCanonico: "Boleto em 3x" });
    expect(armazenamento.conteudo()).toBe(JSON.stringify(["Boleto em 3x"]));
  });

  it("carrega valores personalizados já presentes nos registros sem duplicar", () => {
    const armazenamento = criarArmazenamento(JSON.stringify(["Boleto em 3x"]));

    expect(listarFormasPagamentoPersonalizadas(
      ["boleto em 3x", "Pagamento após embarque", FORMAS_PAGAMENTO[0]],
      armazenamento,
    )).toEqual(["Boleto em 3x", "Pagamento após embarque"]);
  });

  it("remove somente do catálogo futuro", () => {
    const armazenamento = criarArmazenamento();
    const valorSalvoNoCliente = "Pagamento após embarque";
    const formas = removerFormaPagamentoPersonalizada(
      valorSalvoNoCliente,
      ["Boleto em 3x", valorSalvoNoCliente],
      armazenamento,
    );

    expect(formas).toEqual(["Boleto em 3x"]);
    expect(valorSalvoNoCliente).toBe("Pagamento após embarque");
    expect(armazenamento.conteudo()).toBe(JSON.stringify(["Boleto em 3x"]));
    expect(listarFormasPagamentoPersonalizadas([valorSalvoNoCliente], armazenamento)).toEqual(["Boleto em 3x"]);
  });

  it("tolera catálogo local corrompido", () => {
    const armazenamento = criarArmazenamento("{inválido");
    expect(listarFormasPagamentoPersonalizadas(["Pix na entrega"], armazenamento)).toEqual(["Pix na entrega"]);
    expect(CHAVE_FORMAS_PAGAMENTO_PERSONALIZADAS).toContain("formas-pagamento-personalizadas");
  });

  it("tolera SecurityError ao acessar o getter de localStorage", () => {
    const janelaComStorageBloqueado = {};
    Object.defineProperty(janelaComStorageBloqueado, "localStorage", {
      get() {
        throw new DOMException("Acesso bloqueado", "SecurityError");
      },
    });
    vi.stubGlobal("window", janelaComStorageBloqueado);

    expect(listarFormasPagamentoPersonalizadas(["Pix na entrega"])).toEqual(["Pix na entrega"]);
  });

  it("expõe Personalizado e um X acessível para excluir sugestões", () => {
    const modal = readFileSync(
      "src/app/PainelAlpha/CadastroClientes/ModalCadastro/modalDados.tsx",
      "utf8",
    );
    const dropdown = readFileSync(
      "src/app/PainelAlpha/CadastroClientes/ModalCadastro/DropdownSelecaoComCriacao.tsx",
      "utf8",
    );

    expect(modal).toContain('textoBotaoCriar="Personalizado"');
    expect(modal).toContain("opcoesRemoviveis={formasPagamentoPersonalizadas}");
    expect(modal).toContain("formaPagamento: resultado.valorCanonico");
    expect(dropdown).toContain("evento.stopPropagation()");
    expect(dropdown).toContain("aria-label={`Remover forma de pagamento ${o}`}");
  });
});
