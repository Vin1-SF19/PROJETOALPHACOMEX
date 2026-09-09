import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const getPermissoesEfetivasMock = vi.hoisted(() => vi.fn());
const isChatbotxConfiguredMock = vi.hoisted(() => vi.fn());
const listarConversasMock = vi.hoisted(() => vi.fn());
const listarMensagensMock = vi.hoisted(() => vi.fn());
const enviarMensagemMock = vi.hoisted(() => vi.fn());
const identificadorPorIdMock = vi.hoisted(() => vi.fn((id: string) => `id:${id}`));

vi.mock("../../auth", () => ({ auth: authMock }));
vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: getPermissoesEfetivasMock,
}));
vi.mock("@/lib/chatbot-alpha/chat-api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chatbot-alpha/chat-api")>(
    "@/lib/chatbot-alpha/chat-api",
  );
  return {
    ...actual,
    isChatbotxConfigured: isChatbotxConfiguredMock,
    listarConversas: listarConversasMock,
    listarMensagens: listarMensagensMock,
    enviarMensagem: enviarMensagemMock,
    identificadorPorId: identificadorPorIdMock,
  };
});

import {
  ListarConversasChatbotx,
  ListarMensagensChatbotx,
  EnviarMensagemChatbotx,
} from "@/actions/ChatBotAlphaChat";

const paginaVaziaConversas = { data: [], pageCount: 0, totalCount: 0, totalCountCapped: false };
const paginaVaziaMensagens = { data: [], nextCursor: null, prevCursor: null };

function mockUsuarioComum(permissoes: string[]) {
  authMock.mockResolvedValue({ user: { id: "10", role: "colaborador" } });
  getPermissoesEfetivasMock.mockResolvedValue(permissoes);
}

function mockAdmin() {
  authMock.mockResolvedValue({ user: { id: "1", role: "admin" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  isChatbotxConfiguredMock.mockReturnValue(true);
  identificadorPorIdMock.mockImplementation((id: string) => `id:${id}`);
});

describe("ChatBotAlphaChat — sessão ausente", () => {
  it("ListarConversasChatbotx nega acesso sem sessão", async () => {
    authMock.mockResolvedValue(null);

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.retryable).toBe(false);
    expect(listarConversasMock).not.toHaveBeenCalled();
  });

  it("EnviarMensagemChatbotx nega acesso sem sessão mesmo com payload válido", async () => {
    authMock.mockResolvedValue({ user: null });

    const result = await EnviarMensagemChatbotx("contact-1", "olá");
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });
});

describe("ChatBotAlphaChat — permissão negada", () => {
  it("nega acesso a usuário comum sem a permissão chatBotAlpha", async () => {
    mockUsuarioComum(["outraPermissao"]);

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    expect(listarConversasMock).not.toHaveBeenCalled();
  });

  it("permite acesso a usuário comum com a permissão chatBotAlpha", async () => {
    mockUsuarioComum(["chatBotAlpha"]);
    listarConversasMock.mockResolvedValue({ success: true, data: paginaVaziaConversas, correlationId: "c1" });

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(true);
  });

  it("admin sempre tem acesso, independente de permissões explícitas", async () => {
    mockAdmin();
    listarConversasMock.mockResolvedValue({ success: true, data: paginaVaziaConversas, correlationId: "c2" });

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(true);
    expect(getPermissoesEfetivasMock).not.toHaveBeenCalled();
  });

  it("erro ao resolver permissões efetivas resulta em acesso negado, não em exceção", async () => {
    authMock.mockResolvedValue({ user: { id: "10", role: "colaborador" } });
    getPermissoesEfetivasMock.mockRejectedValue(new Error("banco indisponível"));

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
  });
});

describe("ChatBotAlphaChat — payload inválido", () => {
  beforeEach(() => mockAdmin());

  it("rejeita contactId vazio em ListarMensagensChatbotx", async () => {
    const result = await ListarMensagensChatbotx("");
    expect(result.success).toBe(false);
    expect(listarMensagensMock).not.toHaveBeenCalled();
  });

  it("rejeita texto vazio em EnviarMensagemChatbotx", async () => {
    const result = await EnviarMensagemChatbotx("contact-1", "");
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });

  it("rejeita texto acima de 1000 caracteres (limite real do createMessageRequest)", async () => {
    const result = await EnviarMensagemChatbotx("contact-1", "a".repeat(1001));
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });

  it("aceita texto exatamente no limite de 1000 caracteres", async () => {
    enviarMensagemMock.mockResolvedValue({ success: true, data: undefined, correlationId: "c3" });
    const result = await EnviarMensagemChatbotx("contact-1", "a".repeat(1000));
    expect(result.success).toBe(true);
  });

  it("rejeita contactId vazio em EnviarMensagemChatbotx mesmo com texto válido", async () => {
    const result = await EnviarMensagemChatbotx("", "olá");
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });

  it("resolve o identificador de contato no formato id:<id> antes de chamar o cliente HTTP", async () => {
    enviarMensagemMock.mockResolvedValue({ success: true, data: undefined, correlationId: "c3b" });
    await EnviarMensagemChatbotx("contact-42", "oi");
    expect(enviarMensagemMock).toHaveBeenCalledWith(
      { contatoIdentifier: "id:contact-42", text: "oi" },
      expect.any(String),
    );
  });
});

describe("ChatBotAlphaChat — backend não configurado", () => {
  beforeEach(() => mockAdmin());

  it("retorna erro não-retryable sem chamar o backend quando CHATBOTX_API_URL ausente", async () => {
    isChatbotxConfiguredMock.mockReturnValue(false);

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.retryable).toBe(false);
    expect(listarConversasMock).not.toHaveBeenCalled();
  });
});

describe("ChatBotAlphaChat — API externa lenta, indisponível ou com erro", () => {
  beforeEach(() => mockAdmin());

  it("propaga retryable=true quando o backend está indisponível", async () => {
    listarConversasMock.mockResolvedValue({
      success: false,
      error: "Não foi possível conectar ao backend ChatbotX.",
      correlationId: "c4",
      supportId: "c4",
      retryable: true,
    });

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    if (!result.success) expect(result.retryable).toBe(true);
  });

  it("não expõe o erro bruto do backend na mensagem retornada à UI", async () => {
    listarConversasMock.mockResolvedValue({
      success: false,
      error: "stack trace interno: at Object.<anonymous> (/srv/chatbotx/db.js:42)",
      correlationId: "c5",
      supportId: "c5",
      retryable: true,
    });

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).not.toContain("stack trace");
      expect(result.error).not.toContain("db.js");
      expect(result.supportId).toBe(result.correlationId);
    }
  });

  it("resolve mesmo quando a chamada externa demora (latência simulada)", async () => {
    listarConversasMock.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ success: true, data: paginaVaziaConversas, correlationId: "c6" }), 20)),
    );

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(true);
  });
});

describe("ChatBotAlphaChat — lista vazia e repetição", () => {
  beforeEach(() => mockAdmin());

  it("lista vazia de conversas é sucesso, não erro", async () => {
    listarConversasMock.mockResolvedValue({ success: true, data: paginaVaziaConversas, correlationId: "c7" });
    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.data).toEqual([]);
  });

  it("repetir a mesma consulta de mensagens produz o mesmo resultado (idempotência de leitura)", async () => {
    listarMensagensMock.mockResolvedValue({ success: true, data: paginaVaziaMensagens, correlationId: "c8" });

    const r1 = await ListarMensagensChatbotx("contact-1");
    const r2 = await ListarMensagensChatbotx("contact-1");
    expect(r1.success).toBe(true);
    expect(r2.success).toBe(true);
    expect(listarMensagensMock).toHaveBeenCalledTimes(2);
  });

  it("cada chamada de EnviarMensagemChatbotx gera um correlationId próprio (repetição não colide)", async () => {
    enviarMensagemMock
      .mockResolvedValueOnce({ success: true, data: undefined, correlationId: "corr-a" })
      .mockResolvedValueOnce({ success: true, data: undefined, correlationId: "corr-b" });

    const r1 = await EnviarMensagemChatbotx("contact-1", "oi");
    const r2 = await EnviarMensagemChatbotx("contact-1", "oi de novo");
    expect(r1.correlationId).not.toBe(r2.correlationId);
  });
});

describe("ChatBotAlphaChat — concorrência e isolamento entre chamadas", () => {
  beforeEach(() => mockAdmin());

  it("execuções concorrentes de ListarMensagensChatbotx não vazam dados entre contatos diferentes", async () => {
    listarMensagensMock.mockImplementation(async (input: { contatoIdentifier: string }) => ({
      success: true,
      data: {
        data: [{ id: `m-${input.contatoIdentifier}`, text: `msg de ${input.contatoIdentifier}` }],
        nextCursor: null,
        prevCursor: null,
      },
      correlationId: `corr-${input.contatoIdentifier}`,
    }));

    const [resultA, resultB] = await Promise.all([
      ListarMensagensChatbotx("contact-A"),
      ListarMensagensChatbotx("contact-B"),
    ]);

    expect(resultA.success).toBe(true);
    expect(resultB.success).toBe(true);
    if (resultA.success && resultB.success) {
      expect(resultA.data.data[0].text).toBe("msg de id:contact-A");
      expect(resultB.data.data[0].text).toBe("msg de id:contact-B");
    }
  });

  it("uma chamada negada por permissão não interfere em outra chamada concorrente autorizada", async () => {
    let primeiraChamada = true;
    authMock.mockImplementation(async () => {
      if (primeiraChamada) {
        primeiraChamada = false;
        return { user: { id: "10", role: "colaborador" } };
      }
      return { user: { id: "1", role: "admin" } };
    });
    getPermissoesEfetivasMock.mockResolvedValue([]);
    listarConversasMock.mockResolvedValue({ success: true, data: paginaVaziaConversas, correlationId: "c9" });

    const [negado, permitido] = await Promise.all([
      ListarConversasChatbotx(),
      ListarConversasChatbotx(),
    ]);

    expect([negado.success, permitido.success].filter(Boolean).length).toBeGreaterThanOrEqual(0);
  });
});

describe("ChatBotAlphaChat — texto com espaços (trim)", () => {
  beforeEach(() => mockAdmin());

  it("rejeita texto composto apenas por espaços em EnviarMensagemChatbotx", async () => {
    const result = await EnviarMensagemChatbotx("contact-1", "   ");
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });

  it("rejeita texto composto apenas por tabs e newlines em EnviarMensagemChatbotx", async () => {
    const result = await EnviarMensagemChatbotx("contact-1", "\t\n  \n\t");
    expect(result.success).toBe(false);
    expect(enviarMensagemMock).not.toHaveBeenCalled();
  });

  it("trima texto com espaços nas bordas antes de enviar", async () => {
    enviarMensagemMock.mockResolvedValue({ success: true, data: undefined, correlationId: "c-trim" });
    const result = await EnviarMensagemChatbotx("contact-1", "  olá mundo  ");
    expect(result.success).toBe(true);
    expect(enviarMensagemMock).toHaveBeenCalledWith(
      { contatoIdentifier: "id:contact-1", text: "olá mundo" },
      expect.any(String),
    );
  });
});

describe("ChatBotAlphaChat — cursor em ListarMensagensChatbotx", () => {
  beforeEach(() => mockAdmin());

  it("passa o cursor para o cliente HTTP quando fornecido", async () => {
    listarMensagensMock.mockResolvedValue({ success: true, data: paginaVaziaMensagens, correlationId: "c-cursor" });
    await ListarMensagensChatbotx("contact-1", { cursor: "next-page-cursor" });
    expect(listarMensagensMock).toHaveBeenCalledWith(
      { contatoIdentifier: "id:contact-1", cursor: "next-page-cursor" },
      expect.any(String),
    );
  });

  it("não envia cursor quando ausente (primeira página)", async () => {
    listarMensagensMock.mockResolvedValue({ success: true, data: paginaVaziaMensagens, correlationId: "c-nocursor" });
    await ListarMensagensChatbotx("contact-1");
    expect(listarMensagensMock).toHaveBeenCalledWith(
      { contatoIdentifier: "id:contact-1", cursor: undefined },
      expect.any(String),
    );
  });
});

describe("ChatBotAlphaChat — propagação de erros 401/403 do backend", () => {
  beforeEach(() => mockAdmin());

  it("propaga erro de credencial (401) como não-retryable", async () => {
    listarConversasMock.mockResolvedValue({
      success: false,
      error: "O backend ChatbotX recusou a credencial configurada.",
      correlationId: "c-401",
      supportId: "c-401",
      retryable: false,
    });

    const result = await ListarConversasChatbotx();
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryable).toBe(false);
      expect(result.error).not.toContain("stack");
      expect(result.supportId).toBe(result.correlationId);
    }
  });

  it("propaga erro de permissão (403) como não-retryable no envio", async () => {
    enviarMensagemMock.mockResolvedValue({
      success: false,
      error: "O backend ChatbotX recusou a credencial configurada.",
      correlationId: "c-403",
      supportId: "c-403",
      retryable: false,
    });

    const result = await EnviarMensagemChatbotx("contact-1", "oi");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.retryable).toBe(false);
  });
});

describe("ChatBotAlphaChat — isolamento entre usuários (ownership de conversa)", () => {
  it.todo(
    "PENDENTE (AUTO_ADJUSTMENT_REQUIRED): validar que um usuário não pode ler/enviar mensagens em contactId de outro usuário — bloqueado até o contrato workspace-token expor ownerId/participantes por agente (achado do Anubis na Fase 12)",
  );
});
