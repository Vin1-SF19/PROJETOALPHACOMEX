import { describe, expect, it } from "vitest";

import {
  deveEncerrarSessaoPorHeartbeat,
  urlRepresentaLoginDoPainel,
} from "@/lib/auth/navegacao-sessao";

describe("navegação após expiração da sessão", () => {
  it("encerra uma sessão revogada ao receber 403", () => {
    expect(deveEncerrarSessaoPorHeartbeat(403, false)).toBe(true);
  });

  it("encerra no 401 somente quando a janela já esteve autenticada", () => {
    expect(deveEncerrarSessaoPorHeartbeat(401, true)).toBe(true);
    expect(deveEncerrarSessaoPorHeartbeat(401, false)).toBe(false);
  });

  it("não encerra a sessão por respostas sem relação com autenticação", () => {
    expect(deveEncerrarSessaoPorHeartbeat(200, true)).toBe(false);
    expect(deveEncerrarSessaoPorHeartbeat(500, true)).toBe(false);
  });

  it("reconhece o login do próprio Painel Alpha carregado no iframe", () => {
    expect(
      urlRepresentaLoginDoPainel(
        "https://painel.alpha.com/?acesso=bloqueado",
        "https://painel.alpha.com",
      ),
    ).toBe(true);
  });

  it("não confunde módulos internos ou páginas externas com o login", () => {
    expect(
      urlRepresentaLoginDoPainel(
        "https://painel.alpha.com/PainelAlpha/Metas",
        "https://painel.alpha.com",
      ),
    ).toBe(false);
    expect(
      urlRepresentaLoginDoPainel(
        "https://externo.example/",
        "https://painel.alpha.com",
      ),
    ).toBe(false);
    expect(urlRepresentaLoginDoPainel("::::", "https://painel.alpha.com")).toBe(
      false,
    );
  });
});
