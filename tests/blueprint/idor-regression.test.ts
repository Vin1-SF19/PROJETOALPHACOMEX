import { beforeEach, describe, expect, it, vi } from "vitest";

// Regressão dos 6 achados do Anubis: uma action nunca deve alterar/apagar uma entidade
// (arquivo/documento/board) de um PROJETO diferente do informado, mesmo que o chamador
// tenha acesso legítimo a ALGUM projeto (o "projectId" passa no exigirAcessoBlueprint,
// mas o "fileId"/"documentId"/"boardId" pertence a outro projeto).

const prismaMock = vi.hoisted(() => ({
  blueprintMember: { findUnique: vi.fn() },
  blueprintFile: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  blueprintDocument: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), create: vi.fn() },
  blueprintBoard: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
  blueprintActivity: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ default: prismaMock }));
vi.mock("../../auth", () => ({
  auth: vi.fn().mockResolvedValue({ user: { id: "1", role: "User" } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { AtualizarArquivoBlueprint, ArquivarArquivoBlueprint } from "@/actions/BlueprintFiles";
import { SalvarDocumentoBlueprint, ExcluirDocumentoBlueprint } from "@/actions/BlueprintDocuments";
import { SalvarBoardBlueprint, ExcluirBoardBlueprint } from "@/actions/BlueprintBoards";

const PROJETO_ATACANTE = "projeto-do-atacante";
const PROJETO_VITIMA = "projeto-da-vitima";

beforeEach(() => {
  vi.clearAllMocks();
  // Atacante É membro legítimo (PROPRIETARIO) do seu PRÓPRIO projeto — passa no gate de acesso.
  prismaMock.blueprintMember.findUnique.mockResolvedValue({ role: "PROPRIETARIO" });
});

describe("IDOR cross-project — arquivos", () => {
  it("AtualizarArquivoBlueprint recusa alterar arquivo de outro projeto", async () => {
    prismaMock.blueprintFile.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA });
    const res = await AtualizarArquivoBlueprint("arquivo-da-vitima", PROJETO_ATACANTE, { name: "hackeado.png" });
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintFile.update).not.toHaveBeenCalled();
  });

  it("ArquivarArquivoBlueprint recusa arquivar arquivo de outro projeto", async () => {
    prismaMock.blueprintFile.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA });
    const res = await ArquivarArquivoBlueprint("arquivo-da-vitima", PROJETO_ATACANTE);
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintFile.update).not.toHaveBeenCalled();
  });

  it("caminho legítimo (mesmo projeto) continua funcionando", async () => {
    prismaMock.blueprintFile.findUnique.mockResolvedValueOnce({ projectId: PROJETO_ATACANTE });
    prismaMock.blueprintFile.update.mockResolvedValueOnce({ id: "arquivo-proprio" });
    const res = await AtualizarArquivoBlueprint("arquivo-proprio", PROJETO_ATACANTE, { name: "novo-nome.png" });
    expect(res.success).toBe(true);
    expect(prismaMock.blueprintFile.update).toHaveBeenCalledOnce();
  });
});

describe("IDOR cross-project — documentos", () => {
  it("SalvarDocumentoBlueprint (update) recusa sobrescrever documento de outro projeto", async () => {
    prismaMock.blueprintDocument.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA });
    const res = await SalvarDocumentoBlueprint({
      projectId: PROJETO_ATACANTE,
      documentId: "doc-da-vitima",
      contentJson: JSON.stringify({ type: "doc" }),
      title: "Especificação",
    });
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintDocument.update).not.toHaveBeenCalled();
  });

  it("ExcluirDocumentoBlueprint recusa apagar documento de outro projeto", async () => {
    prismaMock.blueprintDocument.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA });
    const res = await ExcluirDocumentoBlueprint("doc-da-vitima", PROJETO_ATACANTE);
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintDocument.delete).not.toHaveBeenCalled();
  });
});

describe("IDOR cross-project — boards/canvas", () => {
  it("SalvarBoardBlueprint (update) recusa sobrescrever canvas de outro projeto", async () => {
    prismaMock.blueprintBoard.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA, version: 1 });
    const res = await SalvarBoardBlueprint({
      projectId: PROJETO_ATACANTE,
      boardId: "board-da-vitima",
      elementsJson: JSON.stringify({ nodes: [], edges: [] }),
    });
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintBoard.update).not.toHaveBeenCalled();
  });

  it("ExcluirBoardBlueprint recusa apagar canvas de outro projeto", async () => {
    prismaMock.blueprintBoard.findUnique.mockResolvedValueOnce({ projectId: PROJETO_VITIMA });
    const res = await ExcluirBoardBlueprint("board-da-vitima", PROJETO_ATACANTE);
    expect(res.success).toBe(false);
    expect(prismaMock.blueprintBoard.delete).not.toHaveBeenCalled();
  });
});
