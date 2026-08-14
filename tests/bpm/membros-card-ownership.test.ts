import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const prismaMock = vi.hoisted(() => ({
  usuarios: { findMany: vi.fn(), findUnique: vi.fn() },
  setorPermissao: { findMany: vi.fn() },
  usuarioPermissaoOverride: { findMany: vi.fn() },
  bpmPipeline: { findUnique: vi.fn() },
  bpmCard: { findUnique: vi.fn() },
  bpmCardMembro: { findFirst: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: prismaMock }));

import {
  checarAcessoBpmCard,
  listarUsuariosVinculaveisBpm,
} from "@/lib/bpm/ownership";

describe("CRM - elegibilidade de pessoas vinculáveis", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.usuarios.findMany.mockResolvedValue([
      { id: 1, nome: "Admin", imagemUrl: null, role: "Admin", status: "ATIVO", permissoes: null },
      { id: 2, nome: "Comercial", imagemUrl: "/comercial.webp", role: "Comercial", status: "ATIVO", permissoes: null },
      { id: 3, nome: "Inativo", imagemUrl: null, role: "Comercial", status: "INATIVO", permissoes: "crm" },
      { id: 4, nome: "Revogado", imagemUrl: null, role: "Financeiro", status: "ATIVO", permissoes: "crm" },
      { id: 5, nome: "Liberado", imagemUrl: "/liberado.webp", role: "Financeiro", status: "ATIVO", permissoes: null },
    ]);
    prismaMock.setorPermissao.findMany.mockResolvedValue([
      { setor: "Comercial", modulo: "crm" },
    ]);
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([
      { usuarioId: 4, modulo: "crm", acao: "REMOVE" },
      { usuarioId: 5, modulo: "crm", acao: "ADD" },
    ]);
  });

  it("filtra por status ativo e permissão CRM efetiva, aplicando override e sem expor dados sensíveis", async () => {
    await expect(listarUsuariosVinculaveisBpm()).resolves.toEqual([
      { id: 1, nome: "Admin", imagemUrl: null },
      { id: 2, nome: "Comercial", imagemUrl: "/comercial.webp" },
      { id: 5, nome: "Liberado", imagemUrl: "/liberado.webp" },
    ]);
    expect(prismaMock.usuarios.findMany).toHaveBeenCalledWith({
      where: { status: "ATIVO" },
      select: {
        id: true,
        nome: true,
        imagemUrl: true,
        role: true,
        status: true,
        permissoes: true,
      },
      orderBy: { nome: "asc" },
    });
    expect(prismaMock.usuarioPermissaoOverride.findMany).toHaveBeenCalledWith({
      where: { usuarioId: { in: [1, 2, 3, 4, 5] } },
      select: { usuarioId: true, modulo: true, acao: true },
    });
  });

  it("permite que participante vinculado execute o trabalho do card, mas nunca gerencie pessoas ou exclua o card", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({
      id: 9,
      role: "COMERCIAL",
      status: "ATIVO",
      permissoes: "crm",
    });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ etapa: { nome: "Em Tratativa" } });
    prismaMock.bpmCardMembro.findUnique.mockResolvedValue({ role: "PARTICIPANTE" });
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);

    for (const acao of [
      "visualizar",
      "editarCard",
      "moverEtapa",
      "criarTarefa",
      "concluirTarefa",
      "enviarArquivo",
      "excluirArquivo",
      "visualizarHistorico",
    ] as const) {
      await expect(
        checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", acao),
      ).resolves.toMatchObject({ autorizado: true, role: "PARTICIPANTE" });
    }
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "adicionarParticipantes"),
    ).resolves.toMatchObject({ autorizado: false });
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "excluirCard"),
    ).resolves.toMatchObject({ autorizado: false });
  });

  it("nega visualização e trabalho imediatamente após a remoção do vínculo", async () => {
    prismaMock.usuarios.findUnique.mockResolvedValue({
      id: 9,
      role: "COMERCIAL",
      status: "ATIVO",
      permissoes: "crm",
    });
    prismaMock.bpmCard.findUnique.mockResolvedValue({ etapa: { nome: "Em Tratativa" } });
    prismaMock.bpmCardMembro.findUnique.mockResolvedValue(null);
    prismaMock.usuarioPermissaoOverride.findMany.mockResolvedValue([]);

    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "visualizar"),
    ).resolves.toMatchObject({ autorizado: false, role: null });
    await expect(
      checarAcessoBpmCard("clw0000000000000card", 9, "COMERCIAL", "editarCard"),
    ).resolves.toMatchObject({ autorizado: false, role: null });
  });

  it("mantém a listagem do board condicionada ao vínculo do usuário não administrador", () => {
    const cardsAction = readFileSync(
      resolve(process.cwd(), "src/actions/bpm/Cards.ts"),
      "utf8",
    );
    expect(cardsAction).toContain("...(admin ? {} : { membros: { some: { userId } } })");
  });
});
