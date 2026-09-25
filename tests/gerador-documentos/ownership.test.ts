import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUniqueTemplate: vi.fn(),
  findUniqueDocumento: vi.fn(),
  findFirstAnexo: vi.fn(),
  exigirAcessoBpmCard: vi.fn(),
  getPermissoesEfetivas: vi.fn(),
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    documentoTemplate: { findUnique: mocks.findUniqueTemplate },
    documentoGerado: { findUnique: mocks.findUniqueDocumento },
    bpmCardAnexo: { findFirst: mocks.findFirstAnexo },
  },
}));

vi.mock("@/lib/bpm/ownership", () => ({ exigirAcessoBpmCard: mocks.exigirAcessoBpmCard }));

vi.mock("@/actions/PermissoesSetor", () => ({
  getPermissoesEfetivas: mocks.getPermissoesEfetivas,
}));

// ownership.ts importa `auth` (para getSessaoGeradorDocumentos) — mock necessário para
// não puxar next-auth de verdade fora do runtime Next.js. Caminho relativo à raiz do
// projeto (Vitest resolve pelo módulo real, não pelo caminho do arquivo de teste).
vi.mock("../../auth", () => ({ auth: mocks.auth }));

import {
  exigirAcessoModulo,
  exigirOwnershipTemplate,
  exigirOwnershipDocumento,
  exigirOwnershipDocumentoPorToken,
} from "@/lib/gerador-documentos/ownership";
import { CONTRATO_PADRAO_ID } from "@/lib/gerador-documentos/contrato-padrao-id";

describe("exigirAcessoModulo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("Admin passa sem consultar permissoes (bypass global)", async () => {
    const ctx = await exigirAcessoModulo(1, "Admin");
    expect(ctx.isAdmin).toBe(true);
    expect(mocks.getPermissoesEfetivas).not.toHaveBeenCalled();
  });

  it("usuário comum com permissão do módulo passa", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue(["geradorDocumentos", "outroModulo"]);
    const ctx = await exigirAcessoModulo(2, "User");
    expect(ctx.isAdmin).toBe(false);
  });

  it("usuário comum SEM permissão é bloqueado", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue(["outroModulo"]);
    await expect(exigirAcessoModulo(3, "User")).rejects.toThrow("Não autorizado");
  });

  it("role null é tratado como não-admin (nunca bypassa por acidente)", async () => {
    mocks.getPermissoesEfetivas.mockResolvedValue([]);
    await expect(exigirAcessoModulo(4, null)).rejects.toThrow("Não autorizado");
  });
});

describe("exigirOwnershipTemplate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("dono do template é autorizado", async () => {
    mocks.findUniqueTemplate.mockResolvedValue({ id: "t1", criadoPorId: 10, status: "ATIVO" });
    const template = await exigirOwnershipTemplate("t1", { userId: 10, role: "User", isAdmin: false });
    expect(template.id).toBe("t1");
  });

  it("outro usuário (não dono, não admin) é bloqueado — previne IDOR", async () => {
    mocks.findUniqueTemplate.mockResolvedValue({ id: "t1", criadoPorId: 10, status: "ATIVO" });
    await expect(
      exigirOwnershipTemplate("t1", { userId: 99, role: "User", isAdmin: false }),
    ).rejects.toThrow("Não autorizado");
  });

  it("admin acessa template de qualquer usuário", async () => {
    mocks.findUniqueTemplate.mockResolvedValue({ id: "t1", criadoPorId: 10, status: "ATIVO" });
    const template = await exigirOwnershipTemplate("t1", { userId: 999, role: "Admin", isAdmin: true });
    expect(template.id).toBe("t1");
  });

  it("template inexistente lança erro específico (não vaza detalhe interno)", async () => {
    mocks.findUniqueTemplate.mockResolvedValue(null);
    await expect(
      exigirOwnershipTemplate("inexistente", { userId: 1, role: "User", isAdmin: false }),
    ).rejects.toThrow("Template não encontrado");
  });

  it("contrato padrão é legível por qualquer usuário autorizado ao módulo", async () => {
    mocks.findUniqueTemplate.mockResolvedValue({ id: CONTRATO_PADRAO_ID, criadoPorId: 8, status: "ATIVO" });
    const template = await exigirOwnershipTemplate(CONTRATO_PADRAO_ID, { userId: 99, role: "User", isAdmin: false }, { leitura: true });
    expect(template.id).toBe(CONTRATO_PADRAO_ID);
  });

  it("contrato padrão não pode ser modificado nem pelo proprietário", async () => {
    mocks.findUniqueTemplate.mockResolvedValue({ id: CONTRATO_PADRAO_ID, criadoPorId: 8, status: "ATIVO" });
    await expect(exigirOwnershipTemplate(CONTRATO_PADRAO_ID, { userId: 8, role: "Admin", isAdmin: true }))
      .rejects.toThrow("O contrato padrão não pode ser alterado");
  });
});

describe("exigirOwnershipDocumento", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirstAnexo.mockResolvedValue(null); });

  it("dono do documento é autorizado", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({ id: "d1", criadoPorId: 5, status: "CONFERENCIA", templateId: "t1" });
    const doc = await exigirOwnershipDocumento("d1", { userId: 5, role: "User", isAdmin: false });
    expect(doc.id).toBe("d1");
  });

  it("outro usuário é bloqueado — nunca acessa documento de terceiro via ID direto", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({ id: "d1", criadoPorId: 5, status: "CONFERENCIA", templateId: "t1" });
    await expect(
      exigirOwnershipDocumento("d1", { userId: 6, role: "User", isAdmin: false }),
    ).rejects.toThrow("Não autorizado");
  });

  it("integrante com acesso de edição ao card vinculado pode conferir o contrato", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({ id: "d1", criadoPorId: 5, status: "CONFERENCIA", templateId: CONTRATO_PADRAO_ID, tokenAcesso: "token-card", variaveisJson: { __bpmCardId: "card-financeiro" } });
    mocks.findFirstAnexo.mockResolvedValue({ cardId: "card-financeiro" });
    mocks.exigirAcessoBpmCard.mockResolvedValue({ autorizado: true });
    await expect(exigirOwnershipDocumento("d1", { userId: 6, role: "Financeiro", isAdmin: false })).resolves.toMatchObject({ id: "d1" });
    expect(mocks.exigirAcessoBpmCard).toHaveBeenCalledWith("card-financeiro", 6, "Financeiro", "editarCard");
    expect(mocks.findFirstAnexo).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ cardId: "card-financeiro" }) }));
  });
});

describe("exigirOwnershipDocumentoPorToken", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.findFirstAnexo.mockResolvedValue(null); });

  it("token sozinho NÃO autoriza — precisa ser o dono também (link não-público, decisão do objetivo original)", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({ id: "d1", criadoPorId: 5, status: "CONFERENCIA", templateId: "t1" });
    await expect(
      exigirOwnershipDocumentoPorToken("token-vazado-publicamente", { userId: 999, role: "User", isAdmin: false }),
    ).rejects.toThrow("Não autorizado");
  });

  it("dono acessando pelo próprio token funciona normalmente", async () => {
    mocks.findUniqueDocumento.mockResolvedValue({ id: "d1", criadoPorId: 5, status: "CONFERENCIA", templateId: "t1" });
    const doc = await exigirOwnershipDocumentoPorToken("token-do-dono", { userId: 5, role: "User", isAdmin: false });
    expect(doc.id).toBe("d1");
  });
});
