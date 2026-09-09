import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function setEnvVar(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function loadModule(env: { url?: string; apiKey?: string; token?: string } = {}) {
  vi.resetModules();
  setEnvVar("CHATBOTX_API_URL", env.url);
  setEnvVar("CHATBOTX_API_KEY", env.apiKey ?? (env.url && !env.token ? "test-api-key" : undefined));
  setEnvVar("CHATBOTX_API_TOKEN", env.token);
  return import("@/lib/chatbot-alpha/chat-api");
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function noContentResponse(): Response {
  return new Response(null, { status: 204 });
}

const contatoValido = {
  id: "contact-1",
  workspaceId: "ws-1",
  fullName: "Fulano",
  phoneNumber: "+5511999999999",
  email: "fulano@example.com",
};

const mensagemValida = {
  id: "msg-1",
  createdAt: "2026-09-08T10:00:00.000Z",
  conversationId: "conv-1",
  contactInboxId: "inbox-1",
  workspaceId: "ws-1",
  text: "Olá",
  messageType: "incoming",
  contentType: "text",
  senderType: "contact",
};

const conversaValida = {
  id: "conv-1",
  contactId: "contact-1",
  workspaceId: "ws-1",
  contact: contatoValido,
  messages: [mensagemValida],
};

const contatoComConversa = {
  ...contatoValido,
  conversation: {
    id: conversaValida.id,
    contactId: conversaValida.contactId,
    workspaceId: conversaValida.workspaceId,
  },
};

const paginaContatos = (data: unknown[]) => ({
  data,
  pageCount: data.length > 0 ? 1 : 0,
  totalCount: data.length,
  totalCountCapped: false,
});

describe("chat-api — identificador de contato", () => {
  it("gera identificador no formato id:<id>", async () => {
    const mod = await loadModule({});
    expect(mod.identificadorPorId("123")).toBe("id:123");
  });

  it("rejeita identificador fora do formato id|email|phone:valor", async () => {
    const mod = await loadModule({});
    expect(mod.contatoIdentifierSchema.safeParse("123").success).toBe(false);
    expect(mod.contatoIdentifierSchema.safeParse("id:123").success).toBe(true);
    expect(mod.contatoIdentifierSchema.safeParse("email:a@b.com").success).toBe(true);
    expect(mod.contatoIdentifierSchema.safeParse("phone:5511999999999").success).toBe(true);
  });
});

describe("chat-api — configuração ausente", () => {
  it("exige URL e chave canônica", async () => {
    const mod = await loadModule({});
    expect(mod.isChatbotxConfigured()).toBe(false);

    const result = await mod.listarConversas({}, "corr-1");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryable).toBe(false);
      expect(result.error).toContain("não configurado");
      expect(result.correlationId).toBe("corr-1");
    }
  });

  it("aceita CHATBOTX_API_TOKEN somente como fallback legado", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com", token: "legacy" });
    expect(mod.isChatbotxConfigured()).toBe(true);
  });

  it("rejeita URL inválida ou com protocolo não HTTP antes de chamar a rede", async () => {
    const invalid = await loadModule({ url: "not-a-url", apiKey: "key" });
    expect(invalid.isChatbotxConfigured()).toBe(false);

    const unsafe = await loadModule({ url: "file:///tmp/chatbotx", apiKey: "key" });
    expect(unsafe.isChatbotxConfigured()).toBe(false);
  });

  it("rejeita página inválida antes de chamar a rede", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.stubGlobal("fetch", vi.fn());
    const result = await mod.listarConversas({ page: Number.NaN }, "corr-invalid");
    expect(result.success).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("chat-api — rede e timeout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("retorna erro retryable quando a API externa está fora do ar", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockRejectedValueOnce(new Error("ECONNREFUSED"));

    const result = await mod.listarConversas({}, "corr-2");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryable).toBe(true);
      expect(result.error).toContain("Não foi possível conectar");
    }
  });

  it("retorna erro retryable e mensagem específica em timeout", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    const timeoutError = new Error("timed out");
    timeoutError.name = "TimeoutError";
    vi.mocked(fetch).mockRejectedValueOnce(timeoutError);

    const result = await mod.listarConversas({}, "corr-3");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryable).toBe(true);
      expect(result.error).toContain("Tempo esgotado");
    }
  });
});

describe("chat-api — respostas HTTP de erro", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("normaliza a mensagem de erro do backend em resposta 404", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "conversa inexistente" }, 404));

    const result = await mod.listarMensagens({ contatoIdentifier: "id:contact-x" }, "corr-4");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Recurso não encontrado no backend ChatbotX.");
      expect(result.retryable).toBe(false);
    }
  });

  it("usa mensagem genérica quando o corpo de erro não é JSON", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>502</html>", { status: 502 }));

    const result = await mod.listarConversas({}, "corr-5");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("Backend ChatbotX temporariamente indisponível.");
      expect(result.retryable).toBe(true);
    }
  });

  it("classifica erro 429 (rate limit) como retryable no envio de mensagem", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "rate limit excedido" }, 429));

    const result = await mod.enviarMensagem({ contatoIdentifier: "id:contact-1", text: "oi" }, "corr-6");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.retryable).toBe(true);
    }
  });

  it("classifica erro 500 como retryable", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "internal" }, 500));

    const result = await mod.listarConversas({}, "corr-7");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.retryable).toBe(true);
  });
});

describe("chat-api — respostas malformadas", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("rejeita corpo não-JSON em resposta 200", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(new Response("not json", { status: 200 }));

    const result = await mod.listarConversas({}, "corr-8");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("não-JSON");
      expect(result.retryable).toBe(false);
    }
  });

  it("rejeita lista de contatos sem envelope paginado", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse([conversaValida]));

    const result = await mod.listarConversas({}, "corr-9");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("malformada");
    }
  });

  it("rejeita conversa com campos obrigatórios ausentes", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(paginaContatos([{ id: "contact-1" }])),
    );

    const result = await mod.listarConversas({}, "corr-10");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("malformada");
  });
});

describe("chat-api — sucesso, paginação e concorrência", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...ORIGINAL_ENV };
  });

  it("retorna lista vazia de conversas sem erro, preservando o envelope de paginação", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(paginaContatos([])));

    const result = await mod.listarConversas({}, "corr-11");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual([]);
      expect(result.data.pageCount).toBe(0);
    }
  });

  it("retorna dados válidos com sucesso e preserva o correlationId", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(
      jsonResponse(paginaContatos([contatoComConversa])),
    );

    const result = await mod.listarConversas({}, "corr-12");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual([{ ...conversaValida, messages: [], contact: contatoComConversa }]);
      expect(result.data.totalCount).toBe(1);
      expect(result.correlationId).toBe("corr-12");
    }
  });

  it("trata sucesso 204 sem corpo no envio de mensagem", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(noContentResponse());

    const result = await mod.enviarMensagem({ contatoIdentifier: "id:contact-1", text: "oi" }, "corr-13");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeUndefined();

    const [url, init] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toContain("/v1/contacts/id%3Acontact-1/messages");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toEqual({ text: "oi" });
  });

  it("envia o token de autorização quando configurado e não quando ausente", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com", apiKey: "secret-key" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(paginaContatos([])));
    await mod.listarConversas({}, "corr-14");

    const [, init] = vi.mocked(fetch).mock.calls[0];
    const headers = init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer secret-key");
  });

  it("isola chamadas concorrentes: uma falha não corrompe o resultado da outra", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse(paginaContatos([contatoComConversa])))
      .mockRejectedValueOnce(new Error("boom"));

    const [okResult, failResult] = await Promise.all([
      mod.listarConversas({}, "corr-15"),
      mod.listarConversas({}, "corr-16"),
    ]);

    expect(okResult.success).toBe(true);
    expect(failResult.success).toBe(false);
    expect(okResult.correlationId).toBe("corr-15");
    if (!failResult.success) expect(failResult.correlationId).toBe("corr-16");
  });

  it("codifica o identificador de contato na URL para evitar path traversal/injeção", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null, prevCursor: null }));
    await mod.listarMensagens({ contatoIdentifier: "id:../../admin?x=1" }, "corr-17");

    const [url] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).not.toContain("../../admin");
    expect(String(url)).toContain(encodeURIComponent("id:../../admin?x=1"));
  });

  it("GET /v1/contacts usa o path e a query esperados (keyword, page, perPage)", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(paginaContatos([])));
    await mod.listarConversas({ keyword: "joão", page: 2, perPage: 25 }, "corr-18");

    const [url] = vi.mocked(fetch).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/v1/contacts");
    expect(parsed.searchParams.get("keyword")).toBe("joão");
    expect(parsed.searchParams.get("page")).toBe("2");
    expect(parsed.searchParams.get("perPage")).toBe("25");
  });

  it("normaliza erro 401 (credencial inválida) como não-retryable", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "invalid token" }, 401));

    const result = await mod.listarConversas({}, "corr-401");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("recusou a credencial");
      expect(result.retryable).toBe(false);
    }
  });

  it("normaliza erro 403 (permissão negada pelo backend) como não-retryable", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ error: "forbidden" }, 403));

    const result = await mod.enviarMensagem({ contatoIdentifier: "id:contact-1", text: "oi" }, "corr-403");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("recusou a credencial");
      expect(result.retryable).toBe(false);
    }
  });

  it("listarMensagens com cursor envia o parâmetro na query", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null, prevCursor: "cursor-abc" }));
    await mod.listarMensagens({ contatoIdentifier: "id:contact-1", cursor: "cursor-abc", perPage: 50 }, "corr-cursor");

    const [url] = vi.mocked(fetch).mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.pathname).toBe("/v1/contacts/id%3Acontact-1/messages");
    expect(parsed.searchParams.get("cursor")).toBe("cursor-abc");
    expect(parsed.searchParams.get("perPage")).toBe("50");
  });

  it("listarMensagens retorna lista vazia com sucesso (conversa sem mensagens)", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null, prevCursor: null }));

    const result = await mod.listarMensagens({ contatoIdentifier: "id:contact-1" }, "corr-empty-msgs");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.data).toEqual([]);
      expect(result.data.nextCursor).toBeNull();
      expect(result.data.prevCursor).toBeNull();
    }
  });

  it("rejeita perPage acima de 100 em listarMensagens antes de chamar a rede", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse({ data: [], nextCursor: null, prevCursor: null }));
    const result = await mod.listarMensagens({ contatoIdentifier: "id:contact-1", perPage: 101 }, "corr-perpage");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain("inválidos");
  });

  it("remove contatos sem conversation do modelo de inbox", async () => {
    const mod = await loadModule({ url: "https://chatbotx.example.com" });
    vi.mocked(fetch).mockResolvedValueOnce(jsonResponse(paginaContatos([contatoValido, contatoComConversa])));
    const result = await mod.listarConversas({}, "corr-19");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.data).toHaveLength(1);
  });
});
