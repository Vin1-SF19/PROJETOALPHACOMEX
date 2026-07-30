import { describe, expect, it } from "vitest";
import {
  criarProjetoSchema,
  atualizarProjetoSchema,
  moverProjetoSchema,
  salvarBoardSchema,
  registrarArquivoSchema,
  criarRequisitoSchema,
  BLUEPRINT_MAX_FILE_SIZE,
} from "@/lib/validations/blueprint";
import { BLUEPRINT_PREMIO_MAX_CENTS } from "@/lib/blueprint/premio";

describe("criarProjetoSchema", () => {
  it("aceita o mínimo obrigatório (nome + solicitante)", () => {
    const r = criarProjetoSchema.safeParse({ title: "Sistema X", requesterId: 1 });
    expect(r.success).toBe(true);
  });

  it("rejeita título vazio", () => {
    const r = criarProjetoSchema.safeParse({ title: "", requesterId: 1 });
    expect(r.success).toBe(false);
  });

  it("rejeita título só com espaços (trim reduz a vazio)", () => {
    const r = criarProjetoSchema.safeParse({ title: "   ", requesterId: 1 });
    expect(r.success).toBe(false);
  });

  it("rejeita título maior que 200 caracteres", () => {
    const r = criarProjetoSchema.safeParse({ title: "a".repeat(201), requesterId: 1 });
    expect(r.success).toBe(false);
  });

  it("rejeita requesterId negativo", () => {
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: -1 });
    expect(r.success).toBe(false);
  });

  it("rejeita requesterId zero", () => {
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 0 });
    expect(r.success).toBe(false);
  });

  it("rejeita requesterId não inteiro", () => {
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 1.5 });
    expect(r.success).toBe(false);
  });

  it("rejeita requesterId ausente", () => {
    const r = criarProjetoSchema.safeParse({ title: "X" });
    expect(r.success).toBe(false);
  });

  it("rejeita priority fora do enum", () => {
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 1, priority: "SUPER_URGENTE" });
    expect(r.success).toBe(false);
  });

  it("aplica default de priority NORMAL quando ausente", () => {
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 1 });
    expect(r.success && r.data.priority).toBe("NORMAL");
  });

  it("aceita mais de 20 tags mas rejeita array maior que o limite", () => {
    const tags = Array.from({ length: 21 }, (_, i) => `tag${i}`);
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 1, tags });
    expect(r.success).toBe(false);
  });

  it("rejeita membrosIds com mais de 50 usuários", () => {
    const membrosIds = Array.from({ length: 51 }, (_, i) => i + 1);
    const r = criarProjetoSchema.safeParse({ title: "X", requesterId: 1, membrosIds });
    expect(r.success).toBe(false);
  });
});

describe("criarProjetoSchema — prêmio", () => {
  it("aceita prêmio em centavos, inclusive zero e o limite do Int", () => {
    expect(criarProjetoSchema.safeParse({ title: "X", requesterId: 1, premioCents: 0 }).success).toBe(true);
    expect(
      criarProjetoSchema.safeParse({
        title: "X",
        requesterId: 1,
        premioCents: BLUEPRINT_PREMIO_MAX_CENTS,
      }).success,
    ).toBe(true);
  });

  it("rejeita prêmio negativo, fracionário ou acima do limite do Int", () => {
    expect(criarProjetoSchema.safeParse({ title: "X", requesterId: 1, premioCents: -1 }).success).toBe(false);
    expect(criarProjetoSchema.safeParse({ title: "X", requesterId: 1, premioCents: 10.5 }).success).toBe(false);
    expect(
      criarProjetoSchema.safeParse({
        title: "X",
        requesterId: 1,
        premioCents: BLUEPRINT_PREMIO_MAX_CENTS + 1,
      }).success,
    ).toBe(false);
  });
});

describe("atualizarProjetoSchema — prêmio", () => {
  const projectId = "clx123456789012345678901234";

  it("aceita remover o prêmio com null", () => {
    expect(atualizarProjetoSchema.safeParse({ projectId, premioCents: null }).success).toBe(true);
  });

  it("aceita atualização sem enviar o campo prêmio", () => {
    const resultado = atualizarProjetoSchema.safeParse({ projectId, summary: "Novo resumo" });
    expect(resultado.success).toBe(true);
    expect(resultado.success && Object.hasOwn(resultado.data, "premioCents")).toBe(false);
  });
});

describe("moverProjetoSchema", () => {
  it("rejeita projectId que não é cuid", () => {
    const r = moverProjetoSchema.safeParse({ projectId: "id-qualquer", novoStatus: "IDEA" });
    expect(r.success).toBe(false);
  });

  it("rejeita novoStatus fora do enum", () => {
    const r = moverProjetoSchema.safeParse({ projectId: "clx123456789012345678901234", novoStatus: "INVALIDO" });
    expect(r.success).toBe(false);
  });

  it("aceita justificativa opcional ausente", () => {
    const r = moverProjetoSchema.safeParse({ projectId: "clx123456789012345678901234", novoStatus: "CONCLUIDO" });
    expect(r.success).toBe(true);
  });
});

describe("salvarBoardSchema — limite de payload do canvas", () => {
  it("rejeita elementsJson acima de 2MB", () => {
    const elementsJsonGigante = JSON.stringify({ nodes: Array(50000).fill({ id: "x", data: "y".repeat(50) }) });
    const r = salvarBoardSchema.safeParse({ projectId: "clx123456789012345678901234", elementsJson: elementsJsonGigante });
    expect(elementsJsonGigante.length).toBeGreaterThan(2 * 1024 * 1024);
    expect(r.success).toBe(false);
  });

  it("aceita elementsJson vazio (canvas novo)", () => {
    const r = salvarBoardSchema.safeParse({ projectId: "clx123456789012345678901234", elementsJson: JSON.stringify({ nodes: [], edges: [] }) });
    expect(r.success).toBe(true);
  });
});

describe("registrarArquivoSchema — allowlist de tipo e tamanho", () => {
  const base = {
    projectId: "clx123456789012345678901234",
    name: "a.png",
    originalName: "a.png",
    url: "https://blob.vercel-storage.com/a.png",
  };

  it("rejeita MIME type fora da allowlist (ex: executável)", () => {
    const r = registrarArquivoSchema.safeParse({ ...base, mimeType: "application/x-msdownload", size: 100 });
    expect(r.success).toBe(false);
  });

  it("aceita imagem PNG dentro do limite", () => {
    const r = registrarArquivoSchema.safeParse({ ...base, mimeType: "image/png", size: 100 });
    expect(r.success).toBe(true);
  });

  it("rejeita arquivo maior que BLUEPRINT_MAX_FILE_SIZE", () => {
    const r = registrarArquivoSchema.safeParse({ ...base, mimeType: "image/png", size: BLUEPRINT_MAX_FILE_SIZE + 1 });
    expect(r.success).toBe(false);
  });

  it("rejeita tamanho zero ou negativo", () => {
    expect(registrarArquivoSchema.safeParse({ ...base, mimeType: "image/png", size: 0 }).success).toBe(false);
    expect(registrarArquivoSchema.safeParse({ ...base, mimeType: "image/png", size: -10 }).success).toBe(false);
  });

  it("rejeita URL que não é uma URL válida", () => {
    const r = registrarArquivoSchema.safeParse({ ...base, url: "não-é-url", mimeType: "image/png", size: 100 });
    expect(r.success).toBe(false);
  });
});

describe("criarRequisitoSchema", () => {
  it("rejeita type fora do enum fixo do domínio", () => {
    const r = criarRequisitoSchema.safeParse({ projectId: "clx123456789012345678901234", title: "X", type: "OUTRO" });
    expect(r.success).toBe(false);
  });

  it("aceita título com caracteres especiais e acentuação", () => {
    const r = criarRequisitoSchema.safeParse({
      projectId: "clx123456789012345678901234",
      title: "Validação de CNPJ (com máscara) — çãõ",
      type: "FUNCIONAL",
    });
    expect(r.success).toBe(true);
  });
});
