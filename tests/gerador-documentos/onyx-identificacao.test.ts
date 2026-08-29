import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createChatSession: vi.fn(),
  sendChatMessageStream: vi.fn(),
}));

vi.mock("@/lib/onyx/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/onyx/client")>("@/lib/onyx/client");
  return {
    ...actual,
    createChatSession: mocks.createChatSession,
    sendChatMessageStream: mocks.sendChatMessageStream,
  };
});

import { identificarVariaveisEClasulasViaIA } from "@/lib/gerador-documentos/onyx";
import { OnyxError } from "@/lib/onyx/client";

/** Monta uma Response cujo body é um stream NDJSON no formato real do Onyx, com o texto dado inteiro em um único message_delta seguido de stop. */
function respostaStreamComTexto(texto: string): Response {
  const linhas = [
    JSON.stringify({ obj: { type: "message_delta", content: texto } }),
    JSON.stringify({ obj: { type: "stop" } }),
  ];
  const corpo = linhas.join("\n") + "\n";
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(corpo));
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

const JSON_VALIDO = {
  variaveis: [{ nome: "nome_cliente", label: "Nome do Cliente", tipo: "texto", obrigatorio: true }],
  clausulas: [{ titulo: "Objeto", conteudo: "O presente contrato tem como objeto {{nome_cliente}}." }],
};

describe("identificarVariaveisEClasulasViaIA", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createChatSession.mockResolvedValue({ chat_session_id: "sess-1" });
  });

  it("aceita JSON limpo (sem markdown ao redor)", async () => {
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(JSON.stringify(JSON_VALIDO)));

    const resultado = await identificarVariaveisEClasulasViaIA("texto do documento");

    expect(resultado.variaveis).toHaveLength(1);
    expect(resultado.clausulas).toHaveLength(1);
    expect(resultado.variaveis[0].nome).toBe("nome_cliente");
  });

  it("aceita JSON cercado de crases markdown (```json ... ```)", async () => {
    const textoComCrases = "```json\n" + JSON.stringify(JSON_VALIDO) + "\n```";
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(textoComCrases));

    const resultado = await identificarVariaveisEClasulasViaIA("texto do documento");

    expect(resultado.clausulas[0].titulo).toBe("Objeto");
  });

  it("aceita JSON com texto explicativo antes e depois", async () => {
    const textoComPreambulo = `Aqui está a análise do documento:\n${JSON.stringify(JSON_VALIDO)}\nEspero que ajude!`;
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(textoComPreambulo));

    const resultado = await identificarVariaveisEClasulasViaIA("texto do documento");

    expect(resultado.variaveis).toHaveLength(1);
  });

  it("lança OnyxError quando a resposta não contém nenhum JSON", async () => {
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto("Desculpe, não consegui analisar este documento."));

    await expect(identificarVariaveisEClasulasViaIA("texto do documento")).rejects.toThrow(OnyxError);
  });

  it("lança OnyxError quando o texto tem chaves mas não é JSON válido", async () => {
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto("{ isso não é json de jeito nenhum }"));

    await expect(identificarVariaveisEClasulasViaIA("texto do documento")).rejects.toThrow(OnyxError);
  });

  it("lança OnyxError quando o JSON é válido mas não bate com o schema (falta campo obrigatório)", async () => {
    const jsonIncompleto = { variaveis: [{ nome: "x" }], clausulas: [] }; // falta label/tipo na variável, clausulas vazio (min 1)
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(JSON.stringify(jsonIncompleto)));

    await expect(identificarVariaveisEClasulasViaIA("texto do documento")).rejects.toThrow(OnyxError);
  });

  it("lança OnyxError quando a IA retorna variáveis com nomes duplicados", async () => {
    const jsonDuplicado = {
      variaveis: [
        { nome: "cliente", label: "Cliente", tipo: "texto", obrigatorio: true },
        { nome: "cliente", label: "Cliente (dup)", tipo: "texto", obrigatorio: true },
      ],
      clausulas: [{ titulo: "Objeto", conteudo: "{{cliente}}" }],
    };
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(JSON.stringify(jsonDuplicado)));

    await expect(identificarVariaveisEClasulasViaIA("texto do documento")).rejects.toThrow(
      "nomes duplicados",
    );
  });

  it("lança OnyxError quando o stream não retorna nenhum texto", async () => {
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(""));

    await expect(identificarVariaveisEClasulasViaIA("texto do documento")).rejects.toThrow(OnyxError);
  });

  it("aceita clausulas com múltiplos itens e variaveis vazio (lista opcional)", async () => {
    const jsonSemVariaveis = {
      variaveis: [],
      clausulas: [
        { titulo: "Objeto", conteudo: "texto fixo sem variável" },
        { titulo: "Prazo", conteudo: "outro texto fixo" },
      ],
    };
    mocks.sendChatMessageStream.mockResolvedValue(respostaStreamComTexto(JSON.stringify(jsonSemVariaveis)));

    const resultado = await identificarVariaveisEClasulasViaIA("texto do documento");

    expect(resultado.variaveis).toHaveLength(0);
    expect(resultado.clausulas).toHaveLength(2);
  });
});
