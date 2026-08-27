import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { iniciarLigacaoCallix, normalizarTelefoneCallix } from "@/lib/callix/click-to-call";

const respostaUsuariosCallix = () => new Response(JSON.stringify({
  data: [{ id: "agente-123", attributes: { login: "agente.login" } }],
}), { status: 200 });

const envOriginal = {
  baseUrl: process.env.CALLIX_BASE_URL,
  token: process.env.TOKEN_CALLIX,
};

afterEach(() => {
  process.env.CALLIX_BASE_URL = envOriginal.baseUrl;
  process.env.TOKEN_CALLIX = envOriginal.token;
  vi.unstubAllGlobals();
});

describe("click-to-call Callix", () => {
  it("normaliza o telefone para dígitos", () => {
    expect(normalizarTelefoneCallix("+55 (11) 99999-0000")).toBe("5511999990000");
    expect(normalizarTelefoneCallix("sem número")).toBeNull();
  });

  it("envia o contrato da Callix apenas com configuração server-side", async () => {
    process.env.CALLIX_BASE_URL = "https://empresa.callix.com.br/";
    process.env.TOKEN_CALLIX = "token-secreto";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(respostaUsuariosCallix())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        click_to_call_id: "call-1",
        message: "Call successfully sent",
      }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await iniciarLigacaoCallix("(11) 99999-0000", "agente-123");

    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://empresa.callix.com.br/api/v1/users", expect.objectContaining({
      headers: {
        Accept: "application/vnd.api+json",
        Authorization: "Bearer token-secreto",
      },
      signal: expect.any(AbortSignal),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "https://empresa.callix.com.br/api/v1/click_to_call", expect.objectContaining({
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.api+json",
        Authorization: "Bearer token-secreto",
      },
      body: JSON.stringify({
        data: {
          type: "click_to_call",
          attributes: { username: "agente.login", phone: "11999990000" },
        },
      }),
      signal: expect.any(AbortSignal),
    }));
    expect(resultado).toEqual({
      success: true,
      data: { id: "call-1", message: "Call successfully sent" },
    });
  });

  it("não chama a API quando falta configuração", async () => {
    delete process.env.CALLIX_BASE_URL;
    delete process.env.TOKEN_CALLIX;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const resultado = await iniciarLigacaoCallix("11999990000", "agente-123");

    expect(resultado).toEqual({ success: false, error: "Integração Callix não configurada." });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [400, "O Callix recusou a ligação. Verifique o ID do agente e o telefone de destino."],
    [401, "A autenticação com o Callix falhou. Verifique a configuração da integração."],
    [404, "O agente configurado não foi encontrado no Callix."],
    [500, "Não foi possível iniciar a ligação no Callix."],
  ])("retorna erro seguro para HTTP %i", async (status, mensagem) => {
    process.env.CALLIX_BASE_URL = "https://empresa.callix.com.br";
    process.env.TOKEN_CALLIX = "token-secreto";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(respostaUsuariosCallix())
      .mockResolvedValueOnce(new Response("erro", { status })));

    await expect(iniciarLigacaoCallix("11999990000", "agente-123")).resolves.toEqual({
      success: false,
      error: mensagem,
    });
  });

  it("informa quando o agente não está disponível no Callix", async () => {
    process.env.CALLIX_BASE_URL = "https://empresa.callix.com.br";
    process.env.TOKEN_CALLIX = "token-secreto";
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(respostaUsuariosCallix())
      .mockResolvedValueOnce(new Response(JSON.stringify({
        errors: [{ title: "User not available to receive this call." }],
      }), { status: 400 })));

    await expect(iniciarLigacaoCallix("11999990000", "agente-123")).resolves.toEqual({
      success: false,
      error: "O agente configurado não está disponível para receber a ligação no Callix.",
    });
  });

  it("retorna erro seguro quando a Callix não responde", async () => {
    process.env.CALLIX_BASE_URL = "https://empresa.callix.com.br";
    process.env.TOKEN_CALLIX = "token-secreto";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(iniciarLigacaoCallix("11999990000", "agente-123")).resolves.toEqual({
      success: false,
      error: "Não foi possível conectar à Callix.",
    });
  });

  it("não inicia a ligação quando o ID não corresponde a um login da Callix", async () => {
    process.env.CALLIX_BASE_URL = "https://empresa.callix.com.br";
    process.env.TOKEN_CALLIX = "token-secreto";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(iniciarLigacaoCallix("11999990000", "agente-123")).resolves.toEqual({
      success: false,
      error: "Não foi possível localizar o login do agente no Callix.",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
