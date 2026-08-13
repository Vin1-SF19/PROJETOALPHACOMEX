import { describe, expect, it } from "vitest";

import {
  configuracaoEntradaFechadoEhValida,
  etapaEhFechado,
  obterStatusPosFechamentoConfig,
  obterStatusPosFechamentoVisivel,
  STATUS_POS_FECHAMENTO_CODIGOS,
  STATUS_POS_FECHAMENTO_CONFIG,
  STATUS_POS_FECHAMENTO_INICIAL,
  STATUS_POS_FECHAMENTO_OPCOES,
  statusPosFechamentoEhValido,
} from "@/lib/bpm/status-pos-fechamento";

describe("contrato do status pós-fechamento", () => {
  it("mantém exatamente os cinco códigos e labels na ordem operacional", () => {
    expect(STATUS_POS_FECHAMENTO_CODIGOS).toEqual([
      "AGUARDANDO_CONTRATO",
      "CONTRATO_A_ENVIAR",
      "CONTRATO_ENVIADO",
      "PAGAMENTO_CONFIRMADO",
      "CONTRATO_ASSINADO",
    ]);
    expect(STATUS_POS_FECHAMENTO_INICIAL).toBe("AGUARDANDO_CONTRATO");
    expect(STATUS_POS_FECHAMENTO_OPCOES.map(({ label }) => label)).toEqual([
      "Aguardando contrato",
      "Contrato a enviar",
      "Contrato enviado",
      "Pagamento confirmado",
      "Contrato assinado",
    ]);
  });

  it("expõe a paleta aprovada sem divergência entre os status", () => {
    expect(STATUS_POS_FECHAMENTO_CONFIG.AGUARDANDO_CONTRATO.badgeClassName)
      .toBe("bg-slate-500/15 text-slate-400 border-slate-500/30");
    expect(STATUS_POS_FECHAMENTO_CONFIG.CONTRATO_A_ENVIAR.badgeClassName)
      .toBe("bg-blue-500/15 text-blue-400 border-blue-500/30");
    expect(STATUS_POS_FECHAMENTO_CONFIG.CONTRATO_ENVIADO.badgeClassName)
      .toBe("bg-amber-500/15 text-amber-400 border-amber-500/30");
    expect(STATUS_POS_FECHAMENTO_CONFIG.PAGAMENTO_CONFIRMADO.badgeClassName)
      .toBe("bg-violet-500/15 text-violet-400 border-violet-500/30");
    expect(STATUS_POS_FECHAMENTO_CONFIG.CONTRATO_ASSINADO.badgeClassName)
      .toBe("bg-emerald-500/15 text-emerald-400 border-emerald-500/30");
  });

  it("reconhece Fechado por nome normalizado, sem depender de ID", () => {
    expect(etapaEhFechado("Fechado")).toBe(true);
    expect(etapaEhFechado("  FECHADO ")).toBe(true);
    expect(etapaEhFechado("Em tratativa")).toBe(false);
    expect(etapaEhFechado(null)).toBe(false);
  });

  it("rejeita valores desconhecidos e só torna status visível em Fechado", () => {
    expect(statusPosFechamentoEhValido("")).toBe(false);
    expect(statusPosFechamentoEhValido("OUTRO")).toBe(false);
    expect(obterStatusPosFechamentoConfig(null)).toBeNull();
    expect(obterStatusPosFechamentoVisivel({
      etapaNome: "Em tratativa",
      status: "CONTRATO_ENVIADO",
    })).toBeNull();
    expect(obterStatusPosFechamentoVisivel({
      etapaNome: "Fechado",
      status: "CONTRATO_ENVIADO",
    })?.label).toBe("Contrato enviado");
  });

  it("valida fail-closed os dois campos canônicos por nome, tipo e catálogo", () => {
    const configuracao = [
      {
        nome: "VÁLOR ACORDADO NO CONTRATO",
        tipo: "numero",
        opcoesJson: null,
        obrigatorio: true,
        contexto: "DESTINO" as const,
      },
      {
        nome: "Forma de Pagamento",
        tipo: "selecao",
        opcoesJson: JSON.stringify(["Pix", "Cartão"]),
        obrigatorio: true,
        contexto: "AMBOS" as const,
      },
    ];

    expect(configuracaoEntradaFechadoEhValida(configuracao)).toBe(true);
    expect(configuracaoEntradaFechadoEhValida(configuracao.slice(0, 1))).toBe(false);
    expect(configuracaoEntradaFechadoEhValida([
      configuracao[0],
      { ...configuracao[1], tipo: "texto" },
    ])).toBe(false);
    expect(configuracaoEntradaFechadoEhValida([
      configuracao[0],
      { ...configuracao[1], opcoesJson: "[]" },
    ])).toBe(false);
    expect(configuracaoEntradaFechadoEhValida([
      configuracao[0],
      { ...configuracao[1], contexto: "ORIGEM" },
    ])).toBe(false);
  });
});
